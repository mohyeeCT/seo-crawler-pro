import { load as loadDom } from './utils/domLite.js';
import { isInternalLink, resolveUrl, normalizeUrl, isBareExternalDomain } from './utils/urlUtils.js';
import { extractSecurityHeaders, isHttps, isMixedContent, isProtocolRelative } from './utils/securityUtils.js';
import { analyzeUrlQuality } from './utils/urlQualityUtils.js';
import { generateContentHash, hasLoremIpsum, isSoft404Content, calculateContentToCodeRatio } from './utils/contentUtils.js';
import { preValidateRedirectLinks } from './utils/linkValidator.js';
import { estimatePixelWidth, calculateReadability } from './utils/textMetrics.js';
import { validateHtmlStructure, findInvalidHeadElements } from './utils/htmlValidator.js';
import { validateAllJsonLd } from './schemaValidator.js';
import { ContentExtractor } from './utils/contentExtractor.js';
/**
 * Parses HTML content and extracts SEO metadata
 */
export async function parseMetadata(html, url, status, depth, responseTime = 0, redirectChain = [], headers = {}, userAgent = 'SEO-CommandLine-Tool/1.0', validateLinks = true) {
    const $ = loadDom(html);
    const issues = [];
    // Extract title
    const titleElements = $('head title');
    const title = titleElements.first().text().trim();
    const titleLength = title.length;
    const titlePixelWidth = estimatePixelWidth(title);
    if (titleElements.length > 1) {
        issues.push({ message: 'Multiple title tags found', severity: 'medium' });
    }
    // Check if title is outside head
    let titlesOutsideHeadCount = 0;
    $('title').each((_, el) => {
        if ($(el).closest('head').length === 0) {
            titlesOutsideHeadCount++;
        }
    });
    if (titlesOutsideHeadCount > 0) {
        issues.push({ message: `${titlesOutsideHeadCount} title tag(s) outside <head>`, severity: 'high' });
    }
    // Extract meta description
    const descriptionElements = $('meta[name="description"]');
    const metaDescription = descriptionElements.first().attr('content')?.trim() || '';
    const metaDescriptionLength = metaDescription.length;
    const metaDescriptionPixelWidth = estimatePixelWidth(metaDescription);
    if (descriptionElements.length > 1) {
        issues.push({ message: 'Multiple meta description tags found', severity: 'low' });
    }
    // Check if meta description is outside head
    let descriptionsOutsideHeadCount = 0;
    $('meta[name="description"]').each((_, el) => {
        if ($(el).closest('head').length === 0) {
            descriptionsOutsideHeadCount++;
        }
    });
    if (descriptionsOutsideHeadCount > 0) {
        issues.push({ message: `${descriptionsOutsideHeadCount} meta description(s) outside <head>`, severity: 'medium' });
    }
    // Extract canonical URL(s)
    const canonicalElements = $('link[rel="canonical"]');
    const canonicalUrls = [];
    canonicalElements.each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
            canonicalUrls.push(href.trim());
        }
    });
    const canonicalUrl = canonicalUrls[0] || undefined;
    if (canonicalUrls.length > 1) {
        // Check if they're different
        const uniqueCanonicals = new Set(canonicalUrls);
        if (uniqueCanonicals.size > 1) {
            issues.push({ message: 'Multiple conflicting canonical tags found', severity: 'high' });
        }
    }
    // Extract meta robots
    const robotsElements = $('meta[name="robots"]');
    const robotsContents = [];
    robotsElements.each((_, element) => {
        const content = $(element).attr('content');
        if (content) {
            robotsContents.push(content.trim());
        }
    });
    // Check for robots meta outside head
    let robotsOutsideHeadCount = 0;
    $('meta[name="robots"]').each((_, el) => {
        if ($(el).closest('head').length === 0)
            robotsOutsideHeadCount++;
    });
    if (robotsOutsideHeadCount > 0) {
        issues.push({
            message: `${robotsOutsideHeadCount} robots meta tag(s) outside <head>`,
            severity: 'high'
        });
    }
    const metaRobots = robotsContents.join(', ');
    const robotsDirectives = parseRobotsDirectives(robotsContents);
    // Check for conflicting robots directives
    if (hasConflictingRobotsDirectives(robotsDirectives)) {
        issues.push({ message: 'Conflicting meta robots directives found', severity: 'high' });
    }
    // Check for specific directives
    if (robotsDirectives.includes('none')) {
        issues.push({ message: 'Page uses "none" directive (equivalent to noindex + nofollow)', severity: 'medium' });
    }
    if (robotsDirectives.includes('nosnippet')) {
        issues.push({ message: 'Page uses "nosnippet" directive (no snippet in search results)', severity: 'low' });
    }
    // Check for unavailable_after directive
    const unavailableAfter = robotsDirectives.find(d => d.startsWith('unavailable_after:'));
    if (unavailableAfter) {
        const dateStr = unavailableAfter.split(':')[1];
        if (dateStr) {
            const unavailableDate = new Date(dateStr);
            const now = new Date();
            if (unavailableDate < now) {
                issues.push({
                    message: `Page marked unavailable after ${dateStr} (date has passed)`,
                    severity: 'medium'
                });
            }
        }
    }
    // Extract Open Graph tags
    const openGraph = {};
    $('meta[property^="og:"]').each((_, element) => {
        const property = $(element).attr('property');
        const content = $(element).attr('content');
        if (property && content) {
            openGraph[property] = content.trim();
        }
    });
    // Extract Twitter Card tags
    const twitterCards = {};
    $('meta[name^="twitter:"]').each((_, element) => {
        const name = $(element).attr('name');
        const content = $(element).attr('content');
        if (name && content) {
            twitterCards[name] = content.trim();
        }
    });
    // Extract hreflang links
    const hreflangs = [];
    const hreflangElements = $('link[rel="alternate"][hreflang]');
    hreflangElements.each((_, element) => {
        const lang = $(element).attr('hreflang');
        const href = $(element).attr('href');
        if (lang && href) {
            hreflangs.push({ lang: lang.trim(), href: href.trim() });
        }
    });
    // Check for hreflang outside head
    let hreflangsOutsideHeadCount = 0;
    $('link[rel="alternate"][hreflang]').each((_, el) => {
        if ($(el).closest('head').length === 0)
            hreflangsOutsideHeadCount++;
    });
    if (hreflangsOutsideHeadCount > 0) {
        issues.push({
            message: `${hreflangsOutsideHeadCount} hreflang link(s) outside <head>`,
            severity: 'medium'
        });
    }
    // Extract structured data
    const structuredData = extractStructuredData($, issues);
    // Validate schema
    const schemaValidation = structuredData.jsonLd.length > 0
        ? validateAllJsonLd(structuredData.jsonLd)
        : undefined;
    // Add schema validation issues
    if (schemaValidation) {
        for (const error of schemaValidation.errors) {
            issues.push({ message: `Schema validation error: ${error}`, severity: 'high' });
        }
        for (const warning of schemaValidation.warnings) {
            issues.push({ message: `Schema validation warning: ${warning}`, severity: 'low' });
        }
    }
    // Extract links
    let links = extractLinks($, url);
    // Validate links that might redirect externally (if validation is enabled)
    if (validateLinks && status === 200) {
        try {
            links = await preValidateRedirectLinks(links, url, userAgent);
        }
        catch (error) {
            // If validation fails, continue with original links but add a warning
            console.warn(`Link validation failed: ${error}`);
        }
    }
    // Detect bare external domain links missing protocol (e.g., "facebook.com")
    try {
        let bareDomainCount = 0;
        $('a[href]').each((_, element) => {
            const rawHref = $(element).attr('href');
            if (rawHref && isBareExternalDomain(rawHref)) {
                bareDomainCount++;
            }
        });
        if (bareDomainCount > 0) {
            issues.push({
                message: `${bareDomainCount} external link(s) missing protocol (e.g., "https://")`,
                severity: 'medium',
            });
        }
    }
    catch { }
    // Extract headings
    const headings = extractHeadings($);
    // Extract images
    const images = extractImages($, url);
    // Extract external scripts
    const externalScripts = extractExternalScripts($, url);
    // Calculate content metrics
    const contentMetrics = calculateContentMetrics($, html);
    // Extract performance and resource metrics
    const resourceMetrics = extractResourceMetrics($, url);
    // Build performance metrics
    const performance = {
        responseTime,
        redirectChain,
        externalResourceCount: resourceMetrics.externalResourceCount,
        renderBlockingResources: resourceMetrics.renderBlockingResources,
        largeInlineScripts: resourceMetrics.largeInlineScripts,
        largeInlineStyles: resourceMetrics.largeInlineStyles,
    };
    // Extract security metrics
    const security = extractSecurityMetrics($, url, headers);
    // Analyze URL quality
    const urlQuality = analyzeUrlQuality(url);
    // Extract HTML validation metrics
    const htmlValidation = validateHtmlStructure($, html);
    // Add invalid head elements to issues
    const invalidHeadElements = findInvalidHeadElements($);
    if (invalidHeadElements.length > 0) {
        issues.push({
            message: `Invalid elements in <head>: ${invalidHeadElements.join(', ')}`,
            severity: 'medium'
        });
    }
    // Extract pagination info
    const pagination = extractPaginationInfo($, url);
    // Validate hreflang
    const hreflangValidation = validateHreflangLinks($, hreflangs, url);
    // Extract enhanced canonical info
    const canonicalInfo = extractCanonicalInfo($, canonicalUrl);
    // Extract content quality metrics
    const contentQuality = extractContentQualityMetrics($, contentMetrics, status);
    return {
        url,
        status,
        depth,
        headers,
        title: title || undefined,
        titleLength,
        titlePixelWidth,
        metaDescription: metaDescription || undefined,
        metaDescriptionLength,
        metaDescriptionPixelWidth,
        canonicalUrl,
        canonicalUrls: canonicalUrls.length > 0 ? canonicalUrls : undefined,
        canonicalInfo,
        metaRobots: metaRobots || undefined,
        robotsDirectives,
        openGraph,
        twitterCards,
        hreflangs,
        hreflangValidation,
        structuredData,
        schemaValidation,
        issues,
        links,
        headings,
        images,
        contentMetrics,
        performance,
        externalScripts,
        security,
        urlQuality,
        contentQuality,
        htmlValidation,
        pagination,
    };
}
/**
 * Parses robots meta directives from content strings
 */
function parseRobotsDirectives(contents) {
    const directives = new Set();
    for (const content of contents) {
        const parts = content.split(',').map(s => s.trim().toLowerCase());
        parts.forEach(directive => directives.add(directive));
    }
    return Array.from(directives);
}
/**
 * Checks if robots directives contain conflicts
 */
function hasConflictingRobotsDirectives(directives) {
    // Check for index/noindex conflict
    const hasIndex = directives.includes('index');
    const hasNoindex = directives.includes('noindex');
    if (hasIndex && hasNoindex) {
        return true;
    }
    // Check for follow/nofollow conflict
    const hasFollow = directives.includes('follow');
    const hasNofollow = directives.includes('nofollow');
    if (hasFollow && hasNofollow) {
        return true;
    }
    return false;
}
/**
 * Extracts structured data (JSON-LD and basic microdata detection)
 */
function extractStructuredData($, issues) {
    const jsonLd = [];
    const microdata = [];
    // Extract JSON-LD
    $('script[type="application/ld+json"]').each((_, element) => {
        const scriptContent = $(element).text();
        if (scriptContent) {
            try {
                const parsed = JSON.parse(scriptContent);
                jsonLd.push(parsed);
            }
            catch (error) {
                issues.push({ message: 'Malformed JSON-LD script found', severity: 'low' });
                jsonLd.push({ error: 'JSON parsing failed', content: scriptContent.substring(0, 100) });
            }
        }
    });
    // Basic microdata detection - count items with itemscope
    $('[itemscope]').each((_, element) => {
        const itemtype = $(element).attr('itemtype');
        const itemid = $(element).attr('itemid');
        microdata.push({
            itemtype: itemtype || 'unknown',
            itemid: itemid || undefined,
        });
    });
    return { jsonLd, microdata };
}
/**
 * Extracts all links from the page
 */
function extractLinks($, baseUrl) {
    const links = [];
    $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (!href)
            return;
        try {
            // If href is a bare domain like "facebook.com", prepend https:// so it resolves correctly
            const hrefToResolve = isBareExternalDomain(href) ? `https://${href}` : href;
            const absoluteUrl = resolveUrl(hrefToResolve, baseUrl);
            const normalizedUrl = normalizeUrl(absoluteUrl);
            const text = $(element).text().trim();
            const rel = $(element).attr('rel') || '';
            const isNofollow = rel.toLowerCase().includes('nofollow');
            const isInternal = isInternalLink(normalizedUrl, baseUrl);
            links.push({
                href: normalizedUrl,
                text: text || '(no text)',
                rel,
                isInternal,
                isNofollow,
            });
        }
        catch (error) {
            // Skip malformed URLs
        }
    });
    return links;
}
/**
 * Extracts all headings (H1-H6) from the page
 */
function extractHeadings($) {
    const headings = [];
    for (let level = 1; level <= 6; level++) {
        $(`h${level}`).each((_, element) => {
            const text = $(element).text().trim();
            if (text) {
                headings.push({
                    level,
                    text,
                });
            }
        });
    }
    return headings;
}
/**
 * Extracts all images from the page
 */
function extractImages($, baseUrl) {
    const images = [];
    // Extract <img> tags
    $('img').each((_, element) => {
        const src = $(element).attr('src');
        if (!src)
            return;
        try {
            const absoluteSrc = resolveUrl(src, baseUrl);
            const alt = $(element).attr('alt') || '';
            const hasAlt = $(element).attr('alt') !== undefined;
            const width = $(element).attr('width');
            const height = $(element).attr('height');
            const hasWidth = width !== undefined;
            const hasHeight = height !== undefined;
            const altTooLong = alt.length > 125;
            images.push({
                src: absoluteSrc,
                alt,
                hasAlt,
                width,
                height,
                hasWidth,
                hasHeight,
                altTooLong,
            });
        }
        catch (error) {
            // Skip malformed URLs
        }
    });
    // Extract background images from inline styles
    $('[style]').each((_, element) => {
        const style = $(element).attr('style');
        if (!style)
            return;
        // Match background-image: url(...) or background: url(...)
        const bgImageMatches = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'"\)]+)['"]?\)/gi);
        if (bgImageMatches) {
            for (const match of bgImageMatches) {
                const urlMatch = match.match(/url\(['"]?([^'"\)]+)['"]?\)/);
                if (urlMatch && urlMatch[1]) {
                    try {
                        const absoluteSrc = resolveUrl(urlMatch[1], baseUrl);
                        // Background images don't have alt text or dimensions
                        images.push({
                            src: absoluteSrc,
                            alt: '(background image)',
                            hasAlt: false,
                            width: undefined,
                            height: undefined,
                            hasWidth: false,
                            hasHeight: false,
                            altTooLong: false,
                        });
                    }
                    catch (error) {
                        // Skip malformed URLs
                    }
                }
            }
        }
    });
    return images;
}
/**
 * Extracts external scripts from the page
 */
function extractExternalScripts($, baseUrl) {
    const scripts = [];
    $('script[src]').each((_, element) => {
        const src = $(element).attr('src');
        if (!src)
            return;
        try {
            // Resolve to absolute URL
            const absoluteSrc = resolveUrl(src, baseUrl);
            const isExternal = !isInternalLink(absoluteSrc, baseUrl);
            // Include ALL scripts with src attribute (both internal and external)
            // This allows users to see all script dependencies, not just third-party ones
            const hasAsync = $(element).attr('async') !== undefined;
            const hasDefer = $(element).attr('defer') !== undefined;
            const type = $(element).attr('type');
            scripts.push({
                src: absoluteSrc,
                async: hasAsync,
                defer: hasDefer,
                type: type || undefined,
                isExternal, // Mark whether it's same-domain or third-party
            });
        }
        catch (error) {
            // Skip malformed URLs
        }
    });
    return scripts;
}
/**
 * Calculates content metrics for the page
 */
function calculateContentMetrics($, html) {
    // Remove script, style, and other non-content elements
    const $body = $('body').clone();
    $body.find('script, style, noscript, iframe').remove();
    const text = $body.text();
    const textLength = text.length;
    // Count words (split by whitespace and filter empty strings)
    const words = text
        .split(/\s+/)
        .filter(word => word.length > 0);
    const wordCount = words.length;
    const htmlSize = Buffer.byteLength(html, 'utf8');
    return {
        wordCount,
        textLength,
        htmlSize,
    };
}
/**
 * Extracts main body text for duplicate detection using advanced scoring algorithm
 * Uses Readability-inspired approach to reliably identify main content
 */
function extractBodyText($) {
    // Use the advanced ContentExtractor with scoring algorithm
    const extractor = new ContentExtractor($);
    const result = extractor.extract();
    return result.text;
}
/**
 * Extracts security metrics from the page
 */
function extractSecurityMetrics($, url, headers) {
    const pageIsHttps = isHttps(url);
    const securityHeaders = extractSecurityHeaders(headers);
    const mixedContentIssues = [];
    const insecureFormActions = [];
    const protocolRelativeUrls = [];
    // Check for mixed content (only relevant on HTTPS pages)
    if (pageIsHttps) {
        // Check images
        $('img[src]').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
                const absoluteSrc = resolveUrl(src, url);
                if (isMixedContent(url, absoluteSrc)) {
                    mixedContentIssues.push({ resourceUrl: absoluteSrc, resourceType: 'image' });
                }
            }
        });
        // Check scripts
        $('script[src]').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
                const absoluteSrc = resolveUrl(src, url);
                if (isMixedContent(url, absoluteSrc)) {
                    mixedContentIssues.push({ resourceUrl: absoluteSrc, resourceType: 'script' });
                }
            }
        });
        // Check stylesheets
        $('link[rel="stylesheet"]').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
                const absoluteHref = resolveUrl(href, url);
                if (isMixedContent(url, absoluteHref)) {
                    mixedContentIssues.push({ resourceUrl: absoluteHref, resourceType: 'stylesheet' });
                }
            }
        });
        // Check iframes
        $('iframe[src]').each((_, element) => {
            const src = $(element).attr('src');
            if (src) {
                const absoluteSrc = resolveUrl(src, url);
                if (isMixedContent(url, absoluteSrc)) {
                    mixedContentIssues.push({ resourceUrl: absoluteSrc, resourceType: 'iframe' });
                }
            }
        });
    }
    // Check for insecure form actions
    $('form[action]').each((_, element) => {
        const action = $(element).attr('action');
        if (action) {
            const absoluteAction = resolveUrl(action, url);
            if (!isHttps(absoluteAction)) {
                insecureFormActions.push(absoluteAction);
            }
        }
    });
    // Check for protocol-relative URLs
    $('[src], [href]').each((_, element) => {
        const $el = $(element);
        const src = $el.attr('src');
        const href = $el.attr('href');
        const resourceUrl = src || href;
        if (resourceUrl && isProtocolRelative(resourceUrl)) {
            protocolRelativeUrls.push(resourceUrl);
        }
    });
    return {
        isHttps: pageIsHttps,
        hasHsts: !!securityHeaders.strictTransportSecurity,
        hasCsp: !!securityHeaders.contentSecurityPolicy,
        hasXContentTypeOptions: !!securityHeaders.xContentTypeOptions,
        hasXFrameOptions: !!securityHeaders.xFrameOptions,
        hasReferrerPolicy: !!securityHeaders.referrerPolicy,
        mixedContentIssues,
        insecureFormActions,
        protocolRelativeUrls,
        securityHeaders: headers,
    };
}
/**
 * Extracts pagination information
 */
function extractPaginationInfo($, baseUrl) {
    const nextLinks = $('link[rel="next"]');
    const prevLinks = $('link[rel="prev"]');
    const nextUrl = nextLinks.length > 0 ? resolveUrl(nextLinks.first().attr('href') || '', baseUrl) : undefined;
    const prevUrl = prevLinks.length > 0 ? resolveUrl(prevLinks.first().attr('href') || '', baseUrl) : undefined;
    const hasPagination = !!nextUrl || !!prevUrl;
    const sequenceErrors = [];
    if (nextLinks.length > 1) {
        sequenceErrors.push('Multiple rel="next" links found');
    }
    if (prevLinks.length > 1) {
        sequenceErrors.push('Multiple rel="prev" links found');
    }
    return {
        hasPagination,
        nextUrl,
        prevUrl,
        isInSequence: sequenceErrors.length === 0,
        sequenceErrors,
    };
}
/**
 * Validates hreflang links
 */
function validateHreflangLinks(_$, hreflangs, baseUrl) {
    const invalidLanguageCodes = [];
    const invalidRegionCodes = [];
    const missingReturnLinks = [];
    // Check for self-reference
    const hasSelfReference = hreflangs.some(link => {
        const absoluteHref = resolveUrl(link.href, baseUrl);
        return normalizeUrl(absoluteHref) === normalizeUrl(baseUrl);
    });
    // Validate language codes format
    const validLanguagePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
    for (const link of hreflangs) {
        if (!validLanguagePattern.test(link.lang) && link.lang !== 'x-default') {
            if (!invalidLanguageCodes.includes(link.lang)) {
                invalidLanguageCodes.push(link.lang);
            }
        }
        // Validate region codes (if present)
        const parts = link.lang.split('-');
        if (parts.length === 2) {
            const regionCode = parts[1];
            // Region codes should be uppercase 2-letter codes
            if (!/^[A-Z]{2}$/.test(regionCode)) {
                if (!invalidRegionCodes.includes(link.lang)) {
                    invalidRegionCodes.push(link.lang);
                }
            }
        }
    }
    // Check for duplicate language codes (report separately)
    const langMap = new Map();
    for (const link of hreflangs) {
        const count = langMap.get(link.lang) || 0;
        langMap.set(link.lang, count + 1);
    }
    const duplicateLanguages = [];
    for (const [lang, count] of langMap.entries()) {
        if (count > 1) {
            duplicateLanguages.push(`${lang} (${count} times)`);
        }
    }
    // Check for x-default if multiple languages
    if (hreflangs.length > 2 && !hreflangs.some(l => l.lang === 'x-default')) {
        invalidLanguageCodes.push('missing x-default for multi-language site');
    }
    return {
        hasSelfReference,
        hasReturnLinks: true, // Would need to fetch other pages to validate
        invalidLanguageCodes,
        invalidRegionCodes,
        duplicateLanguageCodes: duplicateLanguages,
        missingReturnLinks,
    };
}
/**
 * Extracts enhanced canonical information
 */
function extractCanonicalInfo($, canonicalUrl) {
    if (!canonicalUrl) {
        return {
            isRelative: false,
            hasFragment: false,
            hasInvalidAttributes: false,
            isOutsideHead: false,
            pointsToNonIndexable: false,
        };
    }
    const canonicalElements = $('link[rel="canonical"]');
    let isRelative = false;
    let hasFragment = false;
    let hasInvalidAttributes = false;
    let isOutsideHead = false;
    canonicalElements.each((_, element) => {
        const $el = $(element);
        const href = $el.attr('href') || '';
        // Check if relative
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
            isRelative = true;
        }
        // Check for fragment
        if (href.includes('#')) {
            hasFragment = true;
        }
        // Check if outside head
        if ($el.closest('head').length === 0) {
            isOutsideHead = true;
        }
        // Check for invalid attributes (should only have rel and href)
        const attrs = Object.keys((element.attribs) || {});
        const validAttrs = new Set(['rel', 'href']);
        for (const attr of attrs) {
            if (!validAttrs.has(attr)) {
                hasInvalidAttributes = true;
            }
        }
    });
    return {
        canonicalUrl,
        isRelative,
        hasFragment,
        hasInvalidAttributes,
        isOutsideHead,
        pointsToNonIndexable: false, // Would need to fetch the canonical URL to check
    };
}
/**
 * Extracts content quality metrics
 */
function extractContentQualityMetrics($, contentMetrics, status) {
    // Get clean text for analysis (with boilerplate removed for better duplicate detection)
    const bodyText = extractBodyText($);
    // Also get full body text for other quality checks
    const $body = $('body').clone();
    $body.find('script, style, noscript, iframe').remove();
    const fullText = $body.text();
    // Generate content hash from body text (excluding boilerplate)
    const contentHash = generateContentHash(bodyText);
    // Check for lorem ipsum
    const loremIpsum = hasLoremIpsum(fullText);
    // Check for soft 404
    const soft404 = status === 200 && isSoft404Content(fullText, contentMetrics.wordCount);
    // Calculate readability
    const readabilityScore = calculateReadability(fullText);
    // Calculate content-to-code ratio
    const contentToCodeRatio = calculateContentToCodeRatio(contentMetrics.textLength, contentMetrics.htmlSize);
    return {
        contentHash,
        bodyText, // Store extracted body text for duplicate detection
        hasLoremIpsum: loremIpsum,
        readabilityScore,
        contentToCodeRatio,
        spellingErrors: [], // Will be populated by spell checker if enabled
        isSoft404: soft404,
    };
}
/**
 * Extracts resource and performance metrics
 */
function extractResourceMetrics($, baseUrl) {
    const renderBlockingResources = [];
    let externalResourceCount = 0;
    let largeInlineScripts = 0;
    let largeInlineStyles = 0;
    // Count external resources
    $('link[rel="stylesheet"], script[src], img[src]').each((_, element) => {
        const $el = $(element);
        const src = $el.attr('src') || $el.attr('href');
        if (src) {
            try {
                const absoluteSrc = resolveUrl(src, baseUrl);
                if (!isInternalLink(absoluteSrc, baseUrl)) {
                    externalResourceCount++;
                }
            }
            catch {
                // Skip malformed URLs
            }
        }
    });
    // Detect render-blocking resources in head
    $('head link[rel="stylesheet"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
            // CSS in head without media query is render-blocking
            const media = $(element).attr('media');
            if (!media || media === 'all' || media === 'screen') {
                renderBlockingResources.push(href);
            }
        }
    });
    $('head script[src]').each((_, element) => {
        const src = $(element).attr('src');
        const hasAsync = $(element).attr('async') !== undefined;
        const hasDefer = $(element).attr('defer') !== undefined;
        if (src && !hasAsync && !hasDefer) {
            // Script in head without async/defer is render-blocking
            renderBlockingResources.push(src);
        }
    });
    // Check for large inline scripts
    $('script:not([src])').each((_, element) => {
        const content = $(element).text() || '';
        if (content.length > 10240) { // 10KB
            largeInlineScripts++;
        }
    });
    // Check for large inline styles
    $('style').each((_, element) => {
        const content = $(element).text() || '';
        if (content.length > 10240) { // 10KB
            largeInlineStyles++;
        }
    });
    return {
        externalResourceCount,
        renderBlockingResources,
        largeInlineScripts,
        largeInlineStyles,
    };
}
//# sourceMappingURL=parser.js.map