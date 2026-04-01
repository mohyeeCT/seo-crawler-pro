import { analyzeLinkQualityForAllPages } from './linkAnalyzer.js';
import { findExactDuplicates, findNearDuplicates, findDuplicateH1s, findDuplicateH2s, analyzeContentQuality, isUsingNativeModule, } from './contentAnalyzer.js';
import { normalizeUrl, resolveUrl } from './utils/urlUtils.js';
import { calculatePageScore, calculateSiteScore, DEFAULT_WEIGHTS } from './scorer.js';
// SEO best practice thresholds
const TITLE_MIN_LENGTH = 20;
const TITLE_MAX_LENGTH = 60;
const DESCRIPTION_MIN_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 160;
const MIN_WORD_COUNT = 300; // Thin content threshold
const SLOW_PAGE_THRESHOLD = 3000; // 3 seconds in milliseconds
const LARGE_IMAGE_SIZE = 200 * 1024; // 200KB in bytes
function normalizeScoringWeights(weights) {
    const sanitized = {
        technical: Math.max(0, weights.technical),
        content: Math.max(0, weights.content),
        onPage: Math.max(0, weights.onPage),
        links: Math.max(0, weights.links),
        security: Math.max(0, weights.security),
        performance: Math.max(0, weights.performance),
    };
    const total = Object.values(sanitized).reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(total) || total <= 0) {
        return { ...DEFAULT_WEIGHTS };
    }
    const normalized = {
        technical: Math.round((sanitized.technical / total) * 1000) / 1000,
        content: Math.round((sanitized.content / total) * 1000) / 1000,
        onPage: Math.round((sanitized.onPage / total) * 1000) / 1000,
        links: Math.round((sanitized.links / total) * 1000) / 1000,
        security: Math.round((sanitized.security / total) * 1000) / 1000,
        performance: Math.round((sanitized.performance / total) * 1000) / 1000,
    };
    // Ensure rounding keeps the total at ~1.0 by adjusting the largest bucket if necessary.
    const normalizedTotal = Object.values(normalized).reduce((sum, value) => sum + value, 0);
    if (normalizedTotal !== 1) {
        const diff = 1 - normalizedTotal;
        let largestKey = null;
        let largestValue = -Infinity;
        Object.entries(normalized).forEach(([key, value]) => {
            if (value > largestValue) {
                largestKey = key;
                largestValue = value;
            }
        });
        if (largestKey) {
            const adjusted = Math.round((normalized[largestKey] + diff) * 1000) / 1000;
            // Use explicit assignment with type assertion to avoid TypeScript narrowing issues
            normalized[largestKey] = Math.max(0, adjusted);
        }
    }
    return normalized;
}
/**
 * Analyzes all pages for SEO issues
 * Performs per-page checks and site-wide duplicate detection
 */
export function analyzePages(pages, onProgress, options) {
    const totalPages = pages.length;
    // Pass 1: Per-page analysis
    let completed = 0;
    pages.forEach(page => {
        analyzePageIssues(page);
        completed++;
        if (onProgress && completed % Math.max(1, Math.floor(totalPages / 20)) === 0) {
            onProgress('Per-page analysis', completed, totalPages);
        }
    });
    if (onProgress)
        onProgress('Per-page analysis', totalPages, totalPages);
    // Pass 2: Link analysis (requires looking at all pages to find orphans)
    if (onProgress)
        onProgress('Link quality analysis');
    analyzeLinkQualityForAllPages(pages);
    // Pass 3: Content quality analysis
    if (onProgress)
        onProgress('Content quality checks');
    analyzeContentQuality(pages);
    // Pass 4: Site-wide analysis
    if (onProgress)
        onProgress('Finding duplicate titles/descriptions');
    const duplicateTitles = findDuplicateTitles(pages);
    const duplicateDescriptions = findDuplicateDescriptions(pages);
    // Find duplicate content
    if (onProgress)
        onProgress('Finding exact duplicate content');
    const exactDuplicateContent = findExactDuplicates(pages);
    const nearDupMethod = isUsingNativeModule() ? 'Rust + LSH' : 'TypeScript';
    if (onProgress)
        onProgress(`Finding near-duplicate content (${nearDupMethod})`);
    const nearDuplicateContent = findNearDuplicates(pages);
    // Find duplicate headings
    if (onProgress)
        onProgress('Finding duplicate headings');
    const duplicateH1 = findDuplicateH1s(pages);
    const duplicateH2 = findDuplicateH2s(pages);
    // Categorize pages by issue type (existing)
    const missingTitles = pages.filter(p => !p.title || p.title.length === 0);
    const missingDescriptions = pages.filter(p => !p.metaDescription || p.metaDescription.length === 0);
    const longTitles = pages.filter(p => p.titleLength && p.titleLength > TITLE_MAX_LENGTH);
    const shortTitles = pages.filter(p => p.title && p.titleLength && p.titleLength < TITLE_MIN_LENGTH);
    const longDescriptions = pages.filter(p => p.metaDescriptionLength && p.metaDescriptionLength > DESCRIPTION_MAX_LENGTH);
    const shortDescriptions = pages.filter(p => p.metaDescription && p.metaDescriptionLength && p.metaDescriptionLength < DESCRIPTION_MIN_LENGTH);
    // Categorize pages by new issue types
    const missingH1 = pages.filter(p => p.issues.some(i => i.message.includes('Missing H1')));
    const multipleH1 = pages.filter(p => p.issues.some(i => i.message.includes('Multiple H1')));
    const brokenLinks = pages.filter(p => p.status >= 400 && p.status < 500);
    const imagesWithoutAlt = pages.filter(p => p.issues.some(i => i.message.includes('images without alt')));
    const thinContent = pages.filter(p => p.issues.some(i => i.message.includes('Thin content')));
    const slowPages = pages.filter(p => p.issues.some(i => i.message.includes('Slow page')));
    const pagesWithRedirects = pages.filter(p => p.performance.redirectChain.length > 0);
    // Build site structure
    const siteStructure = buildSiteStructure(pages);
    // Aggregate external scripts
    const externalScripts = aggregateExternalScripts(pages);
    // Aggregate data for reports
    const allLinks = pages.flatMap(p => p.links.map(link => ({ ...link, pageUrl: p.url })));
    const allImages = pages.flatMap(p => p.images.map(img => ({ ...img, pageUrl: p.url })));
    const allHeadings = pages.flatMap(p => p.headings.map(heading => ({ ...heading, pageUrl: p.url })));
    // Build 404 referrer map (normalize URLs to avoid trailing-slash mismatches)
    const broken404Pages = pages.filter(p => p.status === 404);
    const referrerMap = new Map();
    // Initialize map with normalized 404 URLs
    for (const page404 of broken404Pages) {
        const normalized404Url = normalizeUrl(page404.url);
        referrerMap.set(normalized404Url, new Set());
    }
    // Collect internal referrers using normalized link hrefs
    for (const page of pages) {
        for (const link of page.links) {
            if (!link.isInternal)
                continue;
            const normalizedHref = normalizeUrl(link.href);
            const refs = referrerMap.get(normalizedHref);
            if (refs) {
                refs.add(page.url);
            }
        }
    }
    const pages404WithReferrers = broken404Pages.map(page => {
        const normalized404Url = normalizeUrl(page.url);
        const refs = referrerMap.get(normalized404Url) || new Set();
        return {
            ...page,
            referrers: Array.from(refs)
        };
    });
    // Count issues
    const issuesSummary = {
        // Metadata issues
        missingTitles: missingTitles.length,
        missingDescriptions: missingDescriptions.length,
        longTitles: longTitles.length,
        shortTitles: shortTitles.length,
        longDescriptions: longDescriptions.length,
        shortDescriptions: shortDescriptions.length,
        duplicateTitles: duplicateTitles.reduce((sum, group) => sum + group.pages.length, 0),
        duplicateDescriptions: duplicateDescriptions.reduce((sum, group) => sum + group.pages.length, 0),
        multipleCanonicals: pages.filter(p => p.issues.some(i => i.message.includes('canonical'))).length,
        conflictingRobots: pages.filter(p => p.issues.some(i => i.message.includes('robots'))).length,
        malformedJsonLd: pages.filter(p => p.issues.some(i => i.message.includes('JSON-LD'))).length,
        // Heading issues
        missingH1: missingH1.length,
        multipleH1: multipleH1.length,
        duplicateH1: duplicateH1.reduce((sum, group) => sum + group.pages.length, 0),
        duplicateH2: duplicateH2.reduce((sum, group) => sum + group.pages.length, 0),
        improperHeadingHierarchy: pages.filter(p => p.issues.some(i => i.message.includes('hierarchy'))).length,
        // Content issues
        brokenLinks: brokenLinks.length,
        imagesWithoutAlt: imagesWithoutAlt.length,
        thinContent: thinContent.length,
        slowPages: slowPages.length,
        redirectChains: pagesWithRedirects.length,
        exactDuplicates: exactDuplicateContent.reduce((sum, group) => sum + (group.pages.length - 1), 0),
        nearDuplicates: nearDuplicateContent.reduce((sum, group) => sum + (group.pages.length - 1), 0),
        soft404s: pages.filter(p => p.contentQuality?.isSoft404).length,
        loremIpsum: pages.filter(p => p.contentQuality?.hasLoremIpsum).length,
        poorReadability: pages.filter(p => p.issues.some(i => i.message.includes('readability'))).length,
        spellingErrors: pages.filter(p => p.contentQuality?.spellingErrors.length && p.contentQuality.spellingErrors.length > 0).length,
        // Security issues (exclude HTTP pages that properly redirect to HTTPS)
        httpPages: pages.filter(p => {
            if (!p.security || p.security.isHttps)
                return false;
            // Don't count as issue if it redirects to HTTPS
            const redirectsToHttps = p.performance.redirectChain.some(r => r.to && r.to.startsWith('https://'));
            return !redirectsToHttps;
        }).length,
        mixedContent: pages.filter(p => p.security && p.security.mixedContentIssues.length > 0).length,
        insecureForms: pages.filter(p => p.security && p.security.insecureFormActions.length > 0).length,
        missingSecurityHeaders: pages.filter(p => p.security && !p.security.hasHsts && !p.security.hasCsp).length,
        // URL quality issues
        urlQualityIssues: pages.filter(p => p.urlQuality && p.urlQuality.issues.length > 0).length,
        nonAsciiUrls: pages.filter(p => p.urlQuality?.hasNonAscii).length,
        uppercaseUrls: pages.filter(p => p.urlQuality?.hasUppercase).length,
        longUrls: pages.filter(p => p.urlQuality && p.urlQuality.urlLength > 100).length,
        // Link issues
        pagesWithoutOutlinks: pages.filter(p => p.linkQuality && !p.linkQuality.hasOutlinks).length,
        highOutlinkCount: pages.filter(p => p.linkQuality && (p.linkQuality.internalOutlinkCount > 100 || p.linkQuality.externalOutlinkCount > 50)).length,
        localhostLinks: pages.filter(p => p.linkQuality?.hasLocalhostLinks).length,
        orphanPages: pages.filter(p => p.linkQuality?.isOrphan).length,
        weakAnchorText: pages.filter(p => p.linkQuality && p.linkQuality.weakAnchorTexts.length > 0).length,
        // HTML validation issues
        htmlStructureIssues: pages.filter(p => p.htmlValidation && (!p.htmlValidation.hasHead || !p.htmlValidation.hasBody || p.htmlValidation.multipleHeads > 1 || p.htmlValidation.multipleBodies > 1)).length,
        largeHtml: pages.filter(p => p.htmlValidation && p.htmlValidation.htmlSize > 1024 * 1024).length,
        // Pagination issues
        paginationIssues: pages.filter(p => p.pagination && p.pagination.sequenceErrors.length > 0).length,
        // Hreflang issues
        hreflangIssues: pages.filter(p => p.hreflangValidation && (p.hreflangValidation.invalidLanguageCodes.length > 0 || !p.hreflangValidation.hasSelfReference)).length,
        // Schema issues
        schemaErrors: pages.filter(p => p.schemaValidation && p.schemaValidation.errors.length > 0).length,
        // Sitemap issues
        notInSitemap: 0, // Will be calculated after sitemap analysis
        orphanInSitemap: 0,
        nonIndexableInSitemap: 0,
    };
    const mergedWeights = {
        ...DEFAULT_WEIGHTS,
        ...options?.scoringWeights,
    };
    const appliedScoringWeights = normalizeScoringWeights(mergedWeights);
    const pageScores = pages.map(page => calculatePageScore(page, appliedScoringWeights));
    const siteScore = calculateSiteScore(pages, pageScores);
    return {
        pages,
        pageScores,
        siteScore,
        appliedScoringWeights,
        // Metadata issues
        duplicateTitles,
        duplicateDescriptions,
        missingTitles,
        missingDescriptions,
        longTitles,
        shortTitles,
        longDescriptions,
        shortDescriptions,
        // Heading issues
        missingH1,
        multipleH1,
        duplicateH1,
        duplicateH2,
        improperHeadingHierarchy: pages.filter(p => p.issues.some(i => i.message.includes('hierarchy'))),
        // Content issues
        brokenLinks,
        imagesWithoutAlt,
        thinContent,
        slowPages,
        pagesWithRedirects,
        exactDuplicateContent,
        nearDuplicateContent,
        soft404Pages: pages.filter(p => p.contentQuality?.isSoft404),
        loremIpsumPages: pages.filter(p => p.contentQuality?.hasLoremIpsum),
        poorReadabilityPages: pages.filter(p => p.issues.some(i => i.message.includes('readability'))),
        spellingErrorPages: pages.filter(p => p.contentQuality?.spellingErrors && p.contentQuality.spellingErrors.length > 0),
        // Security issues (exclude HTTP pages that properly redirect to HTTPS)
        httpPages: pages.filter(p => {
            if (!p.security || p.security.isHttps)
                return false;
            // Don't count as issue if it redirects to HTTPS
            const redirectsToHttps = p.performance.redirectChain.some(r => r.to && r.to.startsWith('https://'));
            return !redirectsToHttps;
        }),
        mixedContentPages: pages.filter(p => p.security && p.security.mixedContentIssues.length > 0),
        insecureFormPages: pages.filter(p => p.security && p.security.insecureFormActions.length > 0),
        missingSecurityHeaderPages: pages.filter(p => p.security && !p.security.hasHsts && !p.security.hasCsp),
        // URL quality issues
        urlQualityIssues: pages.filter(p => p.urlQuality && p.urlQuality.issues.length > 0),
        // Link issues
        pagesWithoutOutlinks: pages.filter(p => p.linkQuality && !p.linkQuality.hasOutlinks && p.status === 200),
        highOutlinkPages: pages.filter(p => p.linkQuality && (p.linkQuality.internalOutlinkCount > 100 || p.linkQuality.externalOutlinkCount > 50)),
        localhostLinkPages: pages.filter(p => p.linkQuality?.hasLocalhostLinks),
        orphanPages: pages.filter(p => p.linkQuality?.isOrphan),
        weakAnchorTextPages: pages.filter(p => p.linkQuality && p.linkQuality.weakAnchorTexts.length > 0),
        // HTML validation issues
        htmlStructureIssues: pages.filter(p => p.htmlValidation && (!p.htmlValidation.hasHead || !p.htmlValidation.hasBody)),
        largeHtmlPages: pages.filter(p => p.htmlValidation && p.htmlValidation.htmlSize > 1024 * 1024),
        // Pagination issues
        paginationIssues: pages.filter(p => p.pagination && p.pagination.sequenceErrors.length > 0),
        // Hreflang issues
        hreflangIssues: pages.filter(p => p.hreflangValidation && (p.hreflangValidation.invalidLanguageCodes.length > 0 || !p.hreflangValidation.hasSelfReference)),
        // Schema issues
        schemaErrorPages: pages.filter(p => p.schemaValidation && p.schemaValidation.errors.length > 0),
        // Summary
        totalPages: pages.length,
        issuesSummary,
        // Aggregated data
        allLinks,
        allImages,
        allHeadings,
        siteStructure,
        externalScripts,
        // 404 pages with referrer information
        pages404: pages404WithReferrers,
        // Sitemap data (will be added later)
        sitemapInfo: undefined,
    };
}
/**
 * Analyzes a single page for SEO issues
 * Adds issues to the page's issues array
 */
function analyzePageIssues(page) {
    // Check title issues
    if (!page.title || page.title.length === 0) {
        page.issues.push({ message: 'Missing title tag', severity: 'high' });
    }
    else {
        if (page.titleLength && page.titleLength > TITLE_MAX_LENGTH) {
            page.issues.push({
                message: `Title too long (${page.titleLength} chars, recommended max: ${TITLE_MAX_LENGTH})`,
                severity: 'medium'
            });
        }
        if (page.titleLength && page.titleLength < TITLE_MIN_LENGTH) {
            page.issues.push({
                message: `Title too short (${page.titleLength} chars, recommended min: ${TITLE_MIN_LENGTH})`,
                severity: 'medium'
            });
        }
    }
    // Check meta description issues
    if (!page.metaDescription || page.metaDescription.length === 0) {
        page.issues.push({ message: 'Missing meta description', severity: 'medium' });
    }
    else {
        if (page.metaDescriptionLength && page.metaDescriptionLength > DESCRIPTION_MAX_LENGTH) {
            page.issues.push({
                message: `Meta description too long (${page.metaDescriptionLength} chars, recommended max: ${DESCRIPTION_MAX_LENGTH})`,
                severity: 'low'
            });
        }
        if (page.metaDescriptionLength && page.metaDescriptionLength < DESCRIPTION_MIN_LENGTH) {
            page.issues.push({
                message: `Meta description too short (${page.metaDescriptionLength} chars, recommended min: ${DESCRIPTION_MIN_LENGTH})`,
                severity: 'low'
            });
        }
    }
    // Check canonical issues
    if (page.canonicalUrls && page.canonicalUrls.length > 1) {
        const uniqueCanonicals = new Set(page.canonicalUrls);
        if (uniqueCanonicals.size > 1) {
            page.issues.push({
                message: `Multiple different canonical URLs found: ${Array.from(uniqueCanonicals).join(', ')}`,
                severity: 'high'
            });
        }
    }
    // Check robots directives issues
    if (page.robotsDirectives && page.robotsDirectives.length > 0) {
        const hasIndex = page.robotsDirectives.includes('index');
        const hasNoindex = page.robotsDirectives.includes('noindex');
        const hasFollow = page.robotsDirectives.includes('follow');
        const hasNofollow = page.robotsDirectives.includes('nofollow');
        if (hasIndex && hasNoindex) {
            page.issues.push({
                message: 'Conflicting robots directives: both "index" and "noindex" found',
                severity: 'high'
            });
        }
        if (hasFollow && hasNofollow) {
            page.issues.push({
                message: 'Conflicting robots directives: both "follow" and "nofollow" found',
                severity: 'medium'
            });
        }
    }
    // Note if page is noindexed (informational, not necessarily an issue)
    if (page.robotsDirectives && page.robotsDirectives.includes('noindex')) {
        page.issues.push({
            message: 'Page is set to noindex (verify this is intentional)',
            severity: 'low'
        });
    }
    // Check for 'none' directive (noindex + nofollow combined)
    if (page.robotsDirectives && page.robotsDirectives.includes('none')) {
        page.issues.push({
            message: 'Page uses "none" directive (blocks indexing and link following)',
            severity: 'medium'
        });
    }
    // Check for restrictive snippet directives
    if (page.robotsDirectives) {
        const hasNosnippet = page.robotsDirectives.includes('nosnippet');
        const hasMaxSnippetZero = page.robotsDirectives.some(d => d === 'max-snippet:0');
        if (hasNosnippet || hasMaxSnippetZero) {
            page.issues.push({
                message: 'Page blocks search result snippets (nosnippet or max-snippet:0)',
                severity: 'low'
            });
        }
    }
    // Check for deprecated directives (informational)
    if (page.robotsDirectives) {
        const deprecatedDirectives = ['noodp', 'noydir'];
        const found = page.robotsDirectives.filter(d => deprecatedDirectives.includes(d));
        if (found.length > 0) {
            page.issues.push({
                message: `Page uses deprecated robots directives: ${found.join(', ')}`,
                severity: 'low'
            });
        }
    }
    // Check heading issues
    const h1Count = page.headings.filter(h => h.level === 1).length;
    if (h1Count === 0) {
        page.issues.push({ message: 'Missing H1 tag', severity: 'high' });
    }
    else if (h1Count > 1) {
        page.issues.push({
            message: `Multiple H1 tags found (${h1Count})`,
            severity: 'medium'
        });
    }
    // Check for improper heading hierarchy
    const headingLevels = page.headings.map(h => h.level);
    for (let i = 1; i < headingLevels.length; i++) {
        if (headingLevels[i] > headingLevels[i - 1] + 1) {
            page.issues.push({
                message: 'Improper heading hierarchy (skipped levels)',
                severity: 'low'
            });
            break;
        }
    }
    // Check image issues
    const imagesWithoutAlt = page.images.filter(img => !img.hasAlt);
    if (imagesWithoutAlt.length > 0) {
        page.issues.push({
            message: `${imagesWithoutAlt.length} images without alt text`,
            severity: 'medium'
        });
    }
    // Check for images without width/height attributes
    const imagesWithoutWidth = page.images.filter(img => !img.hasWidth);
    if (imagesWithoutWidth.length > 0) {
        page.issues.push({
            message: `${imagesWithoutWidth.length} images without width attribute`,
            severity: 'low'
        });
    }
    const imagesWithoutHeight = page.images.filter(img => !img.hasHeight);
    if (imagesWithoutHeight.length > 0) {
        page.issues.push({
            message: `${imagesWithoutHeight.length} images without height attribute`,
            severity: 'low'
        });
    }
    // Check for very long alt text
    const imagesWithLongAlt = page.images.filter(img => img.altTooLong);
    if (imagesWithLongAlt.length > 0) {
        page.issues.push({
            message: `${imagesWithLongAlt.length} images with very long alt text (>125 characters)`,
            severity: 'low'
        });
    }
    // Check for large images (if size is available)
    const largeImages = page.images.filter(img => img.fileSize && img.fileSize > LARGE_IMAGE_SIZE);
    if (largeImages.length > 0) {
        page.issues.push({
            message: `${largeImages.length} images larger than 200KB`,
            severity: 'low'
        });
    }
    // Check content issues
    if (page.contentMetrics.wordCount < MIN_WORD_COUNT && page.status === 200) {
        page.issues.push({
            message: `Thin content (${page.contentMetrics.wordCount} words, recommended min: ${MIN_WORD_COUNT})`,
            severity: 'medium'
        });
    }
    // Check performance issues
    if (page.performance.responseTime > SLOW_PAGE_THRESHOLD) {
        page.issues.push({
            message: `Slow page load (${(page.performance.responseTime / 1000).toFixed(2)}s, recommended max: 3s)`,
            severity: 'medium'
        });
    }
    // Check redirect chains
    if (page.performance.redirectChain.length > 0) {
        page.issues.push({
            message: `${page.performance.redirectChain.length} redirect(s) detected`,
            severity: 'low'
        });
        // Check for multiple redirects (>2 is excessive)
        if (page.performance.redirectChain.length > 2) {
            page.issues.push({
                message: `Excessive redirect chain (${page.performance.redirectChain.length} redirects)`,
                severity: 'medium'
            });
        }
    }
    // Check for render-blocking resources
    if (page.performance.renderBlockingResources.length > 0) {
        page.issues.push({
            message: `${page.performance.renderBlockingResources.length} render-blocking resources detected`,
            severity: 'low'
        });
    }
    // Check for too many external resources
    if (page.performance.externalResourceCount > 50) {
        page.issues.push({
            message: `High external resource count (${page.performance.externalResourceCount} resources)`,
            severity: 'low'
        });
    }
    // Check for large inline scripts/styles
    if (page.performance.largeInlineScripts > 0) {
        page.issues.push({
            message: `${page.performance.largeInlineScripts} large inline script(s) (>10KB)`,
            severity: 'low'
        });
    }
    if (page.performance.largeInlineStyles > 0) {
        page.issues.push({
            message: `${page.performance.largeInlineStyles} large inline style(s) (>10KB)`,
            severity: 'low'
        });
    }
    // Check pixel width issues
    if (page.titlePixelWidth && page.titlePixelWidth > 600) {
        page.issues.push({
            message: `Title may be truncated in search results (${page.titlePixelWidth}px, recommended max: 600px)`,
            severity: 'medium'
        });
    }
    if (page.metaDescriptionPixelWidth && page.metaDescriptionPixelWidth > 990) {
        page.issues.push({
            message: `Meta description may be truncated (${page.metaDescriptionPixelWidth}px, recommended max: 990px)`,
            severity: 'low'
        });
    }
    // Check title matches H1
    if (page.title && page.headings.length > 0) {
        const h1 = page.headings.find(h => h.level === 1);
        if (h1 && page.title === h1.text) {
            page.issues.push({
                message: 'Title is identical to H1 (consider differentiating for better SEO)',
                severity: 'low'
            });
        }
    }
    // Check security issues
    if (page.security) {
        if (!page.security.isHttps) {
            // Check if HTTP page redirects to HTTPS (which is good practice)
            const redirectsToHttps = page.performance.redirectChain.some(redirect => redirect.to && redirect.to.startsWith('https://'));
            // Only flag as issue if it doesn't redirect to HTTPS
            if (!redirectsToHttps) {
                page.issues.push({
                    message: 'Page uses insecure HTTP protocol (implement HTTPS redirect)',
                    severity: 'high'
                });
            }
        }
        if (page.security.isHttps && !page.security.hasHsts) {
            page.issues.push({
                message: 'Missing HSTS security header (recommended for HTTPS sites)',
                severity: 'medium'
            });
        }
        if (!page.security.hasCsp) {
            page.issues.push({
                message: 'Missing Content-Security-Policy header',
                severity: 'low'
            });
        }
        if (page.security.mixedContentIssues.length > 0) {
            const imageIssues = page.security.mixedContentIssues.filter(i => i.resourceType === 'image').length;
            const scriptIssues = page.security.mixedContentIssues.filter(i => i.resourceType === 'script').length;
            const styleIssues = page.security.mixedContentIssues.filter(i => i.resourceType === 'stylesheet').length;
            let details = [];
            if (imageIssues > 0)
                details.push(`${imageIssues} image(s)`);
            if (scriptIssues > 0)
                details.push(`${scriptIssues} script(s)`);
            if (styleIssues > 0)
                details.push(`${styleIssues} stylesheet(s)`);
            page.issues.push({
                message: `Mixed content: ${details.join(', ')} loading over HTTP (update to HTTPS)`,
                severity: 'high'
            });
        }
        if (page.security.insecureFormActions.length > 0) {
            page.issues.push({
                message: `${page.security.insecureFormActions.length} form(s) submitting to HTTP (update action URLs to HTTPS)`,
                severity: 'high'
            });
        }
        if (page.security.protocolRelativeUrls.length > 0) {
            page.issues.push({
                message: `${page.security.protocolRelativeUrls.length} protocol-relative URL(s) detected`,
                severity: 'low'
            });
        }
    }
    // Check URL quality issues
    if (page.urlQuality && page.urlQuality.issues.length > 0) {
        for (const issue of page.urlQuality.issues) {
            page.issues.push({
                message: `URL quality: ${issue}`,
                severity: 'low'
            });
        }
    }
    // Check content quality issues
    if (page.contentQuality) {
        if (page.contentQuality.hasLoremIpsum) {
            page.issues.push({
                message: 'Lorem ipsum placeholder text detected',
                severity: 'high'
            });
        }
        if (page.contentQuality.isSoft404) {
            page.issues.push({
                message: 'Potential soft 404 (page returns 200 but appears to be "not found")',
                severity: 'high'
            });
        }
        const readability = page.contentQuality.readabilityScore;
        if (readability.fleschKincaidGrade > 12) {
            page.issues.push({
                message: `Poor readability (grade level: ${readability.fleschKincaidGrade.toFixed(1)}, recommended: <12)`,
                severity: 'low'
            });
        }
        if (page.contentQuality.contentToCodeRatio < 0.1) {
            page.issues.push({
                message: `Low content-to-code ratio (${(page.contentQuality.contentToCodeRatio * 100).toFixed(1)}%)`,
                severity: 'medium'
            });
        }
    }
    // Check HTML validation issues
    if (page.htmlValidation) {
        if (!page.htmlValidation.hasHead) {
            page.issues.push({
                message: 'Missing <head> tag',
                severity: 'high'
            });
        }
        if (!page.htmlValidation.hasBody) {
            page.issues.push({
                message: 'Missing <body> tag',
                severity: 'high'
            });
        }
        if (page.htmlValidation.multipleHeads > 1) {
            page.issues.push({
                message: `Multiple <head> tags found (${page.htmlValidation.multipleHeads})`,
                severity: 'high'
            });
        }
        if (page.htmlValidation.multipleBodies > 1) {
            page.issues.push({
                message: `Multiple <body> tags found (${page.htmlValidation.multipleBodies})`,
                severity: 'high'
            });
        }
        if (page.htmlValidation.elementsOutsideHead.length > 0) {
            page.issues.push({
                message: `${page.htmlValidation.elementsOutsideHead.length} element(s) outside <head> that should be inside`,
                severity: 'medium'
            });
        }
        if (page.htmlValidation.htmlSize > 1024 * 1024) {
            page.issues.push({
                message: `Very large HTML (${(page.htmlValidation.htmlSize / 1024 / 1024).toFixed(2)}MB)`,
                severity: 'medium'
            });
        }
        if (page.htmlValidation.domDepth > 30) {
            page.issues.push({
                message: `Excessive DOM depth (${page.htmlValidation.domDepth} levels)`,
                severity: 'low'
            });
        }
        if (!page.htmlValidation.hasDoctype) {
            page.issues.push({
                message: 'Missing DOCTYPE declaration',
                severity: 'medium'
            });
        }
        else if (page.htmlValidation.doctypeValue && !page.htmlValidation.doctypeValue.toLowerCase().includes('html')) {
            page.issues.push({
                message: `Invalid DOCTYPE: ${page.htmlValidation.doctypeValue}`,
                severity: 'medium'
            });
        }
        if (page.htmlValidation.deprecatedElements.length > 0) {
            page.issues.push({
                message: `Deprecated HTML elements found: ${page.htmlValidation.deprecatedElements.join(', ')}`,
                severity: 'low'
            });
        }
    }
    // Check canonical issues
    if (page.canonicalInfo) {
        if (page.canonicalInfo.isRelative) {
            page.issues.push({
                message: 'Canonical URL is relative (should be absolute)',
                severity: 'medium'
            });
        }
        if (page.canonicalInfo.hasFragment) {
            page.issues.push({
                message: 'Canonical URL contains fragment (#)',
                severity: 'medium'
            });
        }
        if (page.canonicalInfo.isOutsideHead) {
            page.issues.push({
                message: 'Canonical tag is outside <head>',
                severity: 'high'
            });
        }
        // Check if canonical is self-referencing (good practice)
        if (page.canonicalUrl) {
            const pageUrlNormalized = normalizeUrl(page.url);
            const canonicalNormalized = normalizeUrl(resolveUrl(page.canonicalUrl, page.url));
            if (pageUrlNormalized !== canonicalNormalized) {
                // Page canonicalizes to a different URL
                page.issues.push({
                    message: `Page canonicalizes to different URL: ${page.canonicalUrl}`,
                    severity: 'medium'
                });
            }
        }
    }
    // Check for missing canonical on pages with parameters
    if (!page.canonicalUrl && page.urlQuality?.hasQueryParams) {
        page.issues.push({
            message: 'Missing canonical URL on parameterized page',
            severity: 'medium'
        });
    }
    // Check pagination issues
    if (page.pagination && page.pagination.sequenceErrors.length > 0) {
        for (const error of page.pagination.sequenceErrors) {
            page.issues.push({
                message: `Pagination: ${error}`,
                severity: 'medium'
            });
        }
    }
    // Advanced pagination checks
    if (page.pagination && page.pagination.hasPagination) {
        // Check if paginated page has thin content
        if (page.contentMetrics.wordCount < 200) {
            page.issues.push({
                message: 'Paginated page has very thin content',
                severity: 'low'
            });
        }
        // Check if paginated page is noindexed (this is actually good practice)
        const isNoindexed = page.robotsDirectives?.includes('noindex');
        if (!isNoindexed && page.depth > 1) {
            page.issues.push({
                message: 'Deep paginated page is indexable (consider noindex for page 2+)',
                severity: 'low'
            });
        }
    }
    // Check hreflang issues
    if (page.hreflangValidation) {
        if (page.hreflangs.length > 0 && !page.hreflangValidation.hasSelfReference) {
            page.issues.push({
                message: 'hreflang is missing self-reference',
                severity: 'medium'
            });
        }
        if (page.hreflangValidation.invalidLanguageCodes.length > 0) {
            page.issues.push({
                message: `Invalid hreflang language code(s): ${page.hreflangValidation.invalidLanguageCodes.join(', ')}`,
                severity: 'medium'
            });
        }
        if (page.hreflangValidation.invalidRegionCodes.length > 0) {
            page.issues.push({
                message: `Invalid hreflang region code(s): ${page.hreflangValidation.invalidRegionCodes.join(', ')}`,
                severity: 'medium'
            });
        }
        if (page.hreflangValidation.duplicateLanguageCodes.length > 0) {
            page.issues.push({
                message: `Duplicate hreflang language codes: ${page.hreflangValidation.duplicateLanguageCodes.join(', ')}`,
                severity: 'medium'
            });
        }
    }
    // Calculate indexability
    const indexabilityReasons = [];
    // Check status code
    if (page.status !== 200) {
        indexabilityReasons.push(`HTTP status ${page.status} (not 200)`);
    }
    // Check for noindex directive in meta robots
    if (page.robotsDirectives?.includes('noindex')) {
        indexabilityReasons.push('noindex in meta robots tag');
    }
    // Check X-Robots-Tag header
    const xRobotsTag = page.headers?.['x-robots-tag'];
    if (xRobotsTag && xRobotsTag.toLowerCase().includes('noindex')) {
        indexabilityReasons.push('noindex in X-Robots-Tag header');
    }
    // Check canonical pointing elsewhere
    if (page.canonicalUrl && page.canonicalUrl !== page.url) {
        // Normalize both URLs for comparison
        const normalizedPageUrl = normalizeUrl(page.url);
        const normalizedCanonical = normalizeUrl(page.canonicalUrl);
        if (normalizedPageUrl !== normalizedCanonical) {
            indexabilityReasons.push(`Canonical points to different URL: ${page.canonicalUrl}`);
        }
    }
    // Set indexability info
    page.indexability = {
        isIndexable: indexabilityReasons.length === 0,
        reasons: indexabilityReasons
    };
    // Add high severity issue if page is non-indexable
    if (!page.indexability.isIndexable) {
        page.issues.push({
            message: `Page is not indexable: ${indexabilityReasons.join('; ')}`,
            severity: 'high'
        });
    }
}
/**
 * Finds pages with duplicate titles
 */
function findDuplicateTitles(pages) {
    const titleMap = new Map();
    for (const page of pages) {
        if (page.title && page.title.length > 0) {
            const title = page.title;
            if (!titleMap.has(title)) {
                titleMap.set(title, []);
            }
            titleMap.get(title).push(page.url);
        }
    }
    // Filter to only duplicates (more than one page)
    const duplicates = [];
    for (const [title, urls] of titleMap.entries()) {
        if (urls.length > 1) {
            duplicates.push({ value: title, pages: urls });
        }
    }
    // Sort by number of pages (most duplicates first)
    duplicates.sort((a, b) => b.pages.length - a.pages.length);
    return duplicates;
}
/**
 * Finds pages with duplicate meta descriptions
 */
function findDuplicateDescriptions(pages) {
    const descriptionMap = new Map();
    for (const page of pages) {
        if (page.metaDescription && page.metaDescription.length > 0) {
            const description = page.metaDescription;
            if (!descriptionMap.has(description)) {
                descriptionMap.set(description, []);
            }
            descriptionMap.get(description).push(page.url);
        }
    }
    // Filter to only duplicates
    const duplicates = [];
    for (const [description, urls] of descriptionMap.entries()) {
        if (urls.length > 1) {
            duplicates.push({ value: description, pages: urls });
        }
    }
    // Sort by number of pages
    duplicates.sort((a, b) => b.pages.length - a.pages.length);
    return duplicates;
}
/**
 * Builds a hierarchical site structure from pages
 */
function buildSiteStructure(pages) {
    const rootNodes = [];
    const nodeMap = new Map();
    // Sort pages by URL for consistent structure
    const sortedPages = [...pages].sort((a, b) => a.url.localeCompare(b.url));
    for (const page of sortedPages) {
        try {
            const url = new URL(page.url);
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            // Build path hierarchy
            let currentPath = '';
            let parentNode = null;
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const fullUrl = `${url.protocol}//${url.host}/${currentPath}`;
                let node = nodeMap.get(currentPath);
                if (!node) {
                    node = {
                        path: part,
                        fullUrl,
                        depth: i,
                        children: [],
                        pageData: undefined,
                    };
                    nodeMap.set(currentPath, node);
                    if (parentNode) {
                        parentNode.children.push(node);
                    }
                    else {
                        rootNodes.push(node);
                    }
                }
                // If this is the final part, attach page data
                if (i === pathParts.length - 1) {
                    node.pageData = page;
                }
                parentNode = node;
            }
            // Handle root-level pages (e.g., just the domain)
            if (pathParts.length === 0) {
                const rootKey = '__root__';
                let rootNode = nodeMap.get(rootKey);
                if (!rootNode) {
                    rootNode = {
                        path: '/',
                        fullUrl: page.url,
                        depth: 0,
                        children: [],
                        pageData: page,
                    };
                    nodeMap.set(rootKey, rootNode);
                    rootNodes.push(rootNode);
                }
            }
        }
        catch (error) {
            // Skip malformed URLs
        }
    }
    return rootNodes;
}
/**
 * Aggregates external scripts across all pages
 */
function aggregateExternalScripts(pages) {
    const scriptMap = new Map();
    for (const page of pages) {
        for (const script of page.externalScripts) {
            if (!scriptMap.has(script.src)) {
                scriptMap.set(script.src, {
                    src: script.src,
                    pages: [],
                    count: 0,
                    async: script.async || false,
                    defer: script.defer || false,
                    type: script.type,
                    isExternal: script.isExternal,
                });
            }
            const usage = scriptMap.get(script.src);
            usage.pages.push(page.url);
            usage.count++;
            // Update async/defer if any page has it
            if (script.async)
                usage.async = true;
            if (script.defer)
                usage.defer = true;
        }
    }
    // Sort by usage count (most used first), then by external vs internal
    const scripts = Array.from(scriptMap.values());
    scripts.sort((a, b) => {
        // Sort third-party first, then by count
        if (a.isExternal !== b.isExternal)
            return (b.isExternal ? 1 : 0) - (a.isExternal ? 1 : 0);
        return b.count - a.count;
    });
    return scripts;
}
//# sourceMappingURL=analyzer.js.map