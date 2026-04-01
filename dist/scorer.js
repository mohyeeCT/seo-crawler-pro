const DEFAULT_WEIGHTS = {
    technical: 0.30,
    content: 0.25,
    onPage: 0.25,
    links: 0.10,
    security: 0.05,
    performance: 0.05,
};
const SEVERITY_MULTIPLIERS = {
    high: 1.5,
    medium: 1.0,
    low: 0.5,
};
const CATEGORY_MAX_PENALTIES = {
    technical: 70,
    content: 70,
    onPage: 70,
    links: 50,
    security: 50,
    performance: 50,
};
function clampScore(value) {
    if (Number.isNaN(value))
        return 0;
    return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}
function getGrade(score) {
    if (score >= 90)
        return 'excellent';
    if (score >= 80)
        return 'good';
    if (score >= 70)
        return 'fair';
    if (score >= 50)
        return 'poor';
    return 'critical';
}
function normalizeWeights(weights) {
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    if (total <= 0)
        return DEFAULT_WEIGHTS;
    return {
        technical: weights.technical / total,
        content: weights.content / total,
        onPage: weights.onPage / total,
        links: weights.links / total,
        security: weights.security / total,
        performance: weights.performance / total,
    };
}
function finalizeCategoryScore(category, penalties) {
    const maxPossiblePenalties = CATEGORY_MAX_PENALTIES[category];
    const issueCounts = new Map();
    for (const penalty of penalties) {
        issueCounts.set(penalty.issue, (issueCounts.get(penalty.issue) || 0) + 1);
    }
    let weightedPenalty = 0;
    let appliedPenalty = 0;
    for (const penalty of penalties) {
        const multiplier = SEVERITY_MULTIPLIERS[penalty.severity] ?? 1;
        const occurrence = issueCounts.get(penalty.issue) || 1;
        // Diminishing returns: repeated identical issues contribute less each time
        const diminishing = occurrence > 1 ? 1 / Math.sqrt(occurrence) : 1;
        const base = Math.abs(penalty.points);
        weightedPenalty += base * multiplier * diminishing;
        appliedPenalty += base;
    }
    const normalizedPenalty = Math.min(weightedPenalty, maxPossiblePenalties);
    const score = clampScore(100 - (normalizedPenalty / maxPossiblePenalties) * 100);
    return {
        score,
        maxPossiblePenalties,
        appliedPenalties: Math.round(weightedPenalty * 10) / 10,
        penalties,
    };
}
function addPenalty(penalties, penalty) {
    const entry = {
        category: penalty.category || 'technical',
        issue: penalty.issue,
        severity: penalty.severity,
        points: penalty.points,
        recommendation: penalty.recommendation,
    };
    penalties.push(entry);
}
export function calculatePageImportance(page) {
    const inlinkCount = page.linkQuality?.inlinkCount ?? 0;
    const cappedInlinks = Math.min(inlinkCount, 20);
    const inlinkScore = cappedInlinks / 20; // 0-1
    const depth = page.depth ?? 0;
    const depthScore = Math.max(0, 1 - depth / 5);
    const importanceScore = Math.round(((inlinkScore * 0.7 + depthScore * 0.3) || 0) * 1000) / 1000;
    const isHighPriority = importanceScore >= 0.6 || depth <= 2;
    return { inlinkCount, depth, importanceScore, isHighPriority };
}
function calculateTechnicalScore(page) {
    const penalties = [];
    if (![200, 301, 302].includes(page.status)) {
        addPenalty(penalties, {
            category: 'technical',
            issue: `Non-200 status code (${page.status})`,
            severity: page.status >= 500 ? 'high' : 'medium',
            points: -10,
            recommendation: 'Resolve server errors or unexpected status codes.',
        });
    }
    if ((page.performance?.redirectChain?.length || 0) > 1) {
        addPenalty(penalties, {
            category: 'technical',
            issue: 'Redirect chain detected',
            severity: 'medium',
            points: -5,
            recommendation: 'Link directly to the final destination to eliminate redirect chains.',
        });
    }
    if (page.indexability && !page.indexability.isIndexable) {
        const reasons = page.indexability.reasons.join(', ') || 'Unknown reason';
        addPenalty(penalties, {
            category: 'technical',
            issue: `Page marked non-indexable (${reasons})`,
            severity: reasons.includes('noindex') ? 'high' : 'medium',
            points: reasons.includes('noindex') ? -12 : -8,
            recommendation: 'Review robots directives and ensure important pages are indexable.',
        });
    }
    if ((page.canonicalUrls?.length || 0) > 1) {
        addPenalty(penalties, {
            category: 'technical',
            issue: 'Multiple canonical tags present',
            severity: 'high',
            points: -12,
            recommendation: 'Keep only one canonical tag pointing to the preferred URL.',
        });
    }
    if (page.linkQuality?.isOrphan) {
        addPenalty(penalties, {
            category: 'technical',
            issue: 'Orphan page (no internal inlinks)',
            severity: 'medium',
            points: -7,
            recommendation: 'Add internal links from related pages to surface this content.',
        });
    }
    const urlQuality = page.urlQuality;
    if (urlQuality) {
        if (urlQuality.hasNonAscii) {
            addPenalty(penalties, {
                category: 'technical',
                issue: 'URL contains non-ASCII characters',
                severity: 'low',
                points: -2,
                recommendation: 'Use URL-encoded or ASCII-only characters for URLs.',
            });
        }
        if (urlQuality.hasUppercase) {
            addPenalty(penalties, {
                category: 'technical',
                issue: 'URL contains uppercase letters',
                severity: 'low',
                points: -1,
                recommendation: 'Use lowercase URLs for consistency and to avoid duplicates.',
            });
        }
        if (urlQuality.urlLength > 2083) {
            addPenalty(penalties, {
                category: 'technical',
                issue: `URL exceeds 2083 characters (${urlQuality.urlLength})`,
                severity: 'medium',
                points: -5,
                recommendation: 'Shorten URL paths and remove unnecessary query parameters.',
            });
        }
        if (urlQuality.hasMultipleSlashes) {
            addPenalty(penalties, {
                category: 'technical',
                issue: 'URL contains multiple consecutive slashes',
                severity: 'low',
                points: -2,
                recommendation: 'Normalize URLs to avoid duplicate content issues.',
            });
        }
        if (urlQuality.hasSpaces) {
            addPenalty(penalties, {
                category: 'technical',
                issue: 'URL contains spaces or special characters',
                severity: 'low',
                points: -3,
                recommendation: 'Replace spaces with hyphens and remove special characters.',
            });
        }
        if (urlQuality.hasRepetitivePaths) {
            addPenalty(penalties, {
                category: 'technical',
                issue: 'URL contains repetitive path segments',
                severity: 'low',
                points: -3,
                recommendation: 'Simplify directory structure to reduce repetition.',
            });
        }
    }
    const html = page.htmlValidation;
    if (html) {
        if (!html.hasHead || !html.hasBody) {
            addPenalty(penalties, {
                category: 'technical',
                issue: 'Missing <head> or <body> tag',
                severity: 'high',
                points: -8,
                recommendation: 'Ensure HTML documents include both <head> and <body> elements.',
            });
        }
        if (html.multipleHeads > 1 || html.multipleBodies > 1) {
            addPenalty(penalties, {
                category: 'technical',
                issue: 'Multiple <head> or <body> tags detected',
                severity: 'medium',
                points: -6,
                recommendation: 'Remove duplicate structural tags to maintain valid markup.',
            });
        }
        if (!html.hasDoctype) {
            addPenalty(penalties, {
                category: 'technical',
                issue: 'Missing DOCTYPE declaration',
                severity: 'low',
                points: -2,
                recommendation: 'Add <!DOCTYPE html> to the beginning of the document.',
            });
        }
        if (html.domDepth > 30) {
            addPenalty(penalties, {
                category: 'technical',
                issue: `DOM depth too deep (${html.domDepth} levels)`,
                severity: 'low',
                points: -4,
                recommendation: 'Simplify nested markup to improve crawl efficiency.',
            });
        }
        if (html.htmlSize > 1024 * 1024) {
            addPenalty(penalties, {
                category: 'technical',
                issue: 'HTML document larger than 1MB',
                severity: 'medium',
                points: -5,
                recommendation: 'Minify markup and remove unnecessary inline content.',
            });
        }
    }
    return finalizeCategoryScore('technical', penalties);
}
function calculateContentScore(page) {
    const penalties = [];
    const wordCount = page.contentMetrics?.wordCount ?? 0;
    if (wordCount === 0) {
        addPenalty(penalties, {
            category: 'content',
            issue: 'No indexable body content detected',
            severity: 'high',
            points: -15,
            recommendation: 'Ensure the page serves meaningful HTML content to users.',
        });
    }
    else if (wordCount < 300) {
        addPenalty(penalties, {
            category: 'content',
            issue: `Thin content (${wordCount} words)`,
            severity: 'medium',
            points: -8,
            recommendation: 'Expand the page with unique, value-driven copy.',
        });
    }
    const h1Count = page.headings?.filter(h => h.level === 1).length ?? 0;
    if (h1Count === 0) {
        addPenalty(penalties, {
            category: 'content',
            issue: 'Missing H1 heading',
            severity: 'medium',
            points: -10,
            recommendation: 'Add a single descriptive H1 heading for the page.',
        });
    }
    if (page.contentQuality?.hasLoremIpsum) {
        addPenalty(penalties, {
            category: 'content',
            issue: 'Placeholder text detected (lorem ipsum)',
            severity: 'high',
            points: -12,
            recommendation: 'Replace placeholder copy with original content.',
        });
    }
    if (page.contentQuality?.isSoft404) {
        addPenalty(penalties, {
            category: 'content',
            issue: 'Soft 404 detected',
            severity: 'high',
            points: -20,
            recommendation: 'Return a proper 404 status or restore relevant content.',
        });
    }
    const readability = page.contentQuality?.readabilityScore;
    if (readability) {
        if (readability.fleschReadingEase < 30) {
            addPenalty(penalties, {
                category: 'content',
                issue: 'Very low readability score (Flesch < 30)',
                severity: 'low',
                points: -3,
                recommendation: 'Simplify language and shorten sentences to improve readability.',
            });
        }
        if (readability.averageWordsPerSentence > 30) {
            addPenalty(penalties, {
                category: 'content',
                issue: 'Long sentences detected (avg > 30 words)',
                severity: 'low',
                points: -2,
                recommendation: 'Break up long sentences to aid comprehension.',
            });
        }
        if (readability.fleschKincaidGrade > 12) {
            addPenalty(penalties, {
                category: 'content',
                issue: 'High reading grade level (>12th grade)',
                severity: 'low',
                points: -3,
                recommendation: 'Use simpler vocabulary and shorter sentences where possible.',
            });
        }
    }
    const ratio = page.contentQuality?.contentToCodeRatio ?? 0;
    if (ratio > 0) {
        if (ratio < 0.05) {
            addPenalty(penalties, {
                category: 'content',
                issue: 'Content-to-code ratio below 5%',
                severity: 'medium',
                points: -8,
                recommendation: 'Reduce heavy markup/scripts and add more textual content.',
            });
        }
        else if (ratio < 0.1) {
            addPenalty(penalties, {
                category: 'content',
                issue: 'Content-to-code ratio below 10%',
                severity: 'low',
                points: -6,
                recommendation: 'Balance content with lean markup and assets.',
            });
        }
        else if (ratio < 0.15) {
            addPenalty(penalties, {
                category: 'content',
                issue: 'Content-to-code ratio below 15%',
                severity: 'low',
                points: -4,
                recommendation: 'Increase textual content relative to markup.',
            });
        }
    }
    const spellingErrors = page.contentQuality?.spellingErrors?.length ?? 0;
    if (spellingErrors > 0) {
        addPenalty(penalties, {
            category: 'content',
            issue: `${spellingErrors} potential spelling issues detected`,
            severity: spellingErrors > 10 ? 'medium' : 'low',
            points: spellingErrors > 10 ? -6 : -3,
            recommendation: 'Review spelling suggestions and correct any mistakes.',
        });
    }
    return finalizeCategoryScore('content', penalties);
}
function calculateOnPageScore(page) {
    const penalties = [];
    const titleLength = page.titleLength ?? page.title?.length ?? 0;
    if (!page.title || titleLength === 0) {
        addPenalty(penalties, {
            category: 'onPage',
            issue: 'Missing title tag',
            severity: 'high',
            points: -15,
            recommendation: 'Add a descriptive, unique title tag between 30-60 characters.',
        });
    }
    else {
        if (titleLength > 60) {
            addPenalty(penalties, {
                category: 'onPage',
                issue: `Title too long (${titleLength} characters)`,
                severity: 'medium',
                points: -4,
                recommendation: 'Shorten the title to avoid truncation in SERPs.',
            });
        }
        if (titleLength < 20) {
            addPenalty(penalties, {
                category: 'onPage',
                issue: `Title too short (${titleLength} characters)`,
                severity: 'medium',
                points: -5,
                recommendation: 'Make the title more descriptive while keeping it concise.',
            });
        }
        if (page.title && page.headings?.some(h => h.level === 1 && h.text.trim() === page.title?.trim())) {
            addPenalty(penalties, {
                category: 'onPage',
                issue: 'Title identical to H1 heading',
                severity: 'low',
                points: -2,
                recommendation: 'Differentiate title and H1 to target broader keywords.',
            });
        }
    }
    const descriptionLength = page.metaDescriptionLength ?? page.metaDescription?.length ?? 0;
    if (!page.metaDescription) {
        addPenalty(penalties, {
            category: 'onPage',
            issue: 'Missing meta description',
            severity: 'medium',
            points: -8,
            recommendation: 'Provide a concise summary (50-160 characters).',
        });
    }
    else {
        if (descriptionLength > 160) {
            addPenalty(penalties, {
                category: 'onPage',
                issue: `Meta description too long (${descriptionLength} characters)`,
                severity: 'low',
                points: -3,
                recommendation: 'Keep descriptions under 160 characters to avoid truncation.',
            });
        }
        if (descriptionLength < 50) {
            addPenalty(penalties, {
                category: 'onPage',
                issue: `Meta description too short (${descriptionLength} characters)`,
                severity: 'low',
                points: -4,
                recommendation: 'Expand the description to better summarize the page.',
            });
        }
    }
    const h1Count = page.headings?.filter(h => h.level === 1).length ?? 0;
    if (h1Count > 1) {
        addPenalty(penalties, {
            category: 'onPage',
            issue: `Multiple H1 headings detected (${h1Count})`,
            severity: 'medium',
            points: -8,
            recommendation: 'Use a single H1 and nest subheadings logically.',
        });
    }
    if (page.schemaValidation) {
        if (page.schemaValidation.errors.length > 0) {
            addPenalty(penalties, {
                category: 'onPage',
                issue: `${page.schemaValidation.errors.length} structured data errors`,
                severity: 'medium',
                points: -4,
                recommendation: 'Fix schema errors to ensure eligibility for rich results.',
            });
        }
        if (page.schemaValidation.warnings.length > 0) {
            addPenalty(penalties, {
                category: 'onPage',
                issue: `${page.schemaValidation.warnings.length} structured data warnings`,
                severity: 'low',
                points: -2,
                recommendation: 'Review warnings to provide richer structured data.',
            });
        }
    }
    if (page.structuredData?.jsonLd?.length === 0 && page.structuredData?.microdata?.length === 0) {
        addPenalty(penalties, {
            category: 'onPage',
            issue: 'No structured data detected',
            severity: 'low',
            points: -3,
            recommendation: 'Add relevant schema markup for key content types.',
        });
    }
    if (page.openGraph && Object.keys(page.openGraph).length === 0) {
        addPenalty(penalties, {
            category: 'onPage',
            issue: 'Missing Open Graph metadata',
            severity: 'low',
            points: -2,
            recommendation: 'Add Open Graph tags for improved social sharing.',
        });
    }
    return finalizeCategoryScore('onPage', penalties);
}
function calculateLinksScore(page) {
    const penalties = [];
    const linkQuality = page.linkQuality;
    if (linkQuality) {
        if (!linkQuality.hasOutlinks) {
            addPenalty(penalties, {
                category: 'links',
                issue: 'Page has no internal outlinks (dead end)',
                severity: 'medium',
                points: -5,
                recommendation: 'Add contextual links to guide users and bots.',
            });
        }
        if (linkQuality.internalOutlinkCount > 100) {
            addPenalty(penalties, {
                category: 'links',
                issue: `High internal link count (${linkQuality.internalOutlinkCount})`,
                severity: 'low',
                points: -3,
                recommendation: 'Trim excessive internal links to improve crawl focus.',
            });
        }
        if (linkQuality.externalOutlinkCount > 50) {
            addPenalty(penalties, {
                category: 'links',
                issue: `High external link count (${linkQuality.externalOutlinkCount})`,
                severity: 'low',
                points: -2,
                recommendation: 'Ensure external links are relevant and purposeful.',
            });
        }
        if (linkQuality.hasLocalhostLinks) {
            addPenalty(penalties, {
                category: 'links',
                issue: 'Localhost/test environment links detected',
                severity: 'medium',
                points: -8,
                recommendation: 'Remove or update localhost links before publishing.',
            });
        }
        if (linkQuality.weakAnchorTexts.length > 5) {
            addPenalty(penalties, {
                category: 'links',
                issue: 'Weak anchor text usage detected',
                severity: 'low',
                points: -2,
                recommendation: 'Use descriptive anchor text to improve context.',
            });
        }
    }
    const brokenLinks = page.links.filter(l => l.status && l.status >= 400 && l.status < 600);
    if (brokenLinks.length > 0) {
        addPenalty(penalties, {
            category: 'links',
            issue: `${brokenLinks.length} broken links detected`,
            severity: 'high',
            points: Math.min(-10, -2 * brokenLinks.length),
            recommendation: 'Fix or remove broken links to improve user experience.',
        });
    }
    const imagesWithoutAlt = page.images.filter(img => !img.hasAlt).length;
    if (imagesWithoutAlt > 0) {
        addPenalty(penalties, {
            category: 'links',
            issue: `${imagesWithoutAlt} images missing alt text`,
            severity: imagesWithoutAlt > 10 ? 'medium' : 'low',
            points: imagesWithoutAlt > 10 ? -4 : -2,
            recommendation: 'Add concise, descriptive alt text for accessibility.',
        });
    }
    const imagesWithoutDimensions = page.images.filter(img => !img.hasWidth || !img.hasHeight).length;
    if (imagesWithoutDimensions > 0) {
        addPenalty(penalties, {
            category: 'links',
            issue: `${imagesWithoutDimensions} images missing width/height attributes`,
            severity: 'low',
            points: -1,
            recommendation: 'Set width and height to reduce layout shifts.',
        });
    }
    return finalizeCategoryScore('links', penalties);
}
function calculateSecurityScore(page) {
    const penalties = [];
    const security = page.security;
    if (!security) {
        addPenalty(penalties, {
            category: 'security',
            issue: 'Security headers not evaluated',
            severity: 'low',
            points: -2,
            recommendation: 'Ensure HTTPS and standard security headers are implemented.',
        });
        return finalizeCategoryScore('security', penalties);
    }
    if (!security.isHttps) {
        addPenalty(penalties, {
            category: 'security',
            issue: 'Page served over HTTP',
            severity: 'high',
            points: -12,
            recommendation: 'Serve all pages over HTTPS with valid certificates.',
        });
    }
    if (security.mixedContentIssues.length > 0) {
        addPenalty(penalties, {
            category: 'security',
            issue: `${security.mixedContentIssues.length} mixed content resources`,
            severity: 'high',
            points: -8,
            recommendation: 'Load all assets over HTTPS to avoid browser warnings.',
        });
    }
    if (security.insecureFormActions.length > 0) {
        addPenalty(penalties, {
            category: 'security',
            issue: 'Forms submit over insecure protocol',
            severity: 'high',
            points: -15,
            recommendation: 'Use HTTPS action URLs for all forms.',
        });
    }
    const missingHeaders = [];
    if (!security.hasHsts)
        missingHeaders.push('HSTS');
    if (!security.hasCsp)
        missingHeaders.push('CSP');
    if (!security.hasXFrameOptions)
        missingHeaders.push('X-Frame-Options');
    if (!security.hasXContentTypeOptions)
        missingHeaders.push('X-Content-Type-Options');
    if (!security.hasReferrerPolicy)
        missingHeaders.push('Referrer-Policy');
    if (missingHeaders.length > 0) {
        addPenalty(penalties, {
            category: 'security',
            issue: `Missing security headers: ${missingHeaders.join(', ')}`,
            severity: missingHeaders.length > 2 ? 'medium' : 'low',
            points: missingHeaders.length > 2 ? -6 : -3,
            recommendation: 'Configure recommended security headers for modern browsers.',
        });
    }
    if (security.protocolRelativeUrls.length > 0) {
        addPenalty(penalties, {
            category: 'security',
            issue: `${security.protocolRelativeUrls.length} protocol-relative URLs`,
            severity: 'low',
            points: -3,
            recommendation: 'Use explicit https:// URLs to avoid downgrade attacks.',
        });
    }
    return finalizeCategoryScore('security', penalties);
}
function calculatePerformanceScore(page) {
    const penalties = [];
    const performance = page.performance;
    if (!performance) {
        addPenalty(penalties, {
            category: 'performance',
            issue: 'Performance metrics unavailable',
            severity: 'low',
            points: -3,
            recommendation: 'Ensure performance metrics are collected during analysis.',
        });
        return finalizeCategoryScore('performance', penalties);
    }
    if (performance.responseTime > 5000) {
        addPenalty(penalties, {
            category: 'performance',
            issue: `Very slow response time (${performance.responseTime}ms)`,
            severity: 'medium',
            points: -6,
            recommendation: 'Investigate server response times and heavy resources.',
        });
    }
    else if (performance.responseTime > 3000) {
        addPenalty(penalties, {
            category: 'performance',
            issue: `Slow response time (${performance.responseTime}ms)`,
            severity: 'medium',
            points: -4,
            recommendation: 'Optimize server performance or use a CDN.',
        });
    }
    else if (performance.responseTime > 2500) {
        addPenalty(penalties, {
            category: 'performance',
            issue: 'Potential LCP issue (response time > 2.5s)',
            severity: 'medium',
            points: -5,
            recommendation: 'Improve Largest Contentful Paint by optimizing critical assets.',
        });
    }
    if (performance.redirectChain.length > 0) {
        addPenalty(penalties, {
            category: 'performance',
            issue: `${performance.redirectChain.length} redirect hops before final URL`,
            severity: 'low',
            points: -3,
            recommendation: 'Reduce redirect hops to speed up page loads.',
        });
    }
    if (performance.renderBlockingResources.length > 0) {
        addPenalty(penalties, {
            category: 'performance',
            issue: `${performance.renderBlockingResources.length} render blocking resources`,
            severity: 'low',
            points: -3,
            recommendation: 'Defer non-critical CSS/JS to improve first paint.',
        });
    }
    if (performance.externalResourceCount > 80) {
        addPenalty(penalties, {
            category: 'performance',
            issue: `High external resource count (${performance.externalResourceCount})`,
            severity: 'low',
            points: -4,
            recommendation: 'Combine and minify assets to reduce requests.',
        });
    }
    if (performance.largeInlineScripts > 0) {
        addPenalty(penalties, {
            category: 'performance',
            issue: `${performance.largeInlineScripts} large inline scripts`,
            severity: 'low',
            points: -2,
            recommendation: 'Move large scripts to external files and minify.',
        });
    }
    if (performance.largeInlineStyles > 0) {
        addPenalty(penalties, {
            category: 'performance',
            issue: `${performance.largeInlineStyles} large inline styles`,
            severity: 'low',
            points: -2,
            recommendation: 'Move large styles to external CSS files.',
        });
    }
    const html = page.htmlValidation;
    if (html && html.htmlSize > 1024 * 1024) {
        addPenalty(penalties, {
            category: 'performance',
            issue: 'HTML payload exceeds 1MB',
            severity: 'medium',
            points: -5,
            recommendation: 'Reduce HTML size by removing unnecessary markup.',
        });
    }
    return finalizeCategoryScore('performance', penalties);
}
export function calculatePageScore(page, weights = DEFAULT_WEIGHTS) {
    const normalizedWeights = normalizeWeights(weights);
    const technicalScore = calculateTechnicalScore(page);
    const contentScore = calculateContentScore(page);
    const onPageScore = calculateOnPageScore(page);
    const linksScore = calculateLinksScore(page);
    const securityScore = calculateSecurityScore(page);
    const performanceScore = calculatePerformanceScore(page);
    const baseScore = (technicalScore.score * normalizedWeights.technical +
        contentScore.score * normalizedWeights.content +
        onPageScore.score * normalizedWeights.onPage +
        linksScore.score * normalizedWeights.links +
        securityScore.score * normalizedWeights.security +
        performanceScore.score * normalizedWeights.performance);
    let overallScore = clampScore(baseScore);
    const importance = calculatePageImportance(page);
    if (!importance.isHighPriority && importance.importanceScore < 0.3 && page.depth > 3) {
        const recovered = (100 - overallScore) * 0.5;
        overallScore = clampScore(overallScore + recovered);
    }
    const grade = getGrade(overallScore);
    const categoryScores = {
        technical: technicalScore,
        content: contentScore,
        onPage: onPageScore,
        links: linksScore,
        security: securityScore,
        performance: performanceScore,
    };
    const allPenalties = [
        ...technicalScore.penalties,
        ...contentScore.penalties,
        ...onPageScore.penalties,
        ...linksScore.penalties,
        ...securityScore.penalties,
        ...performanceScore.penalties,
    ];
    const recommendations = allPenalties
        .slice()
        .sort((a, b) => Math.abs(b.points) * (SEVERITY_MULTIPLIERS[b.severity] ?? 1) - Math.abs(a.points) * (SEVERITY_MULTIPLIERS[a.severity] ?? 1))
        .slice(0, 5)
        .map(p => p.recommendation || `Fix: ${p.issue}`)
        .filter(Boolean);
    const totalPenalties = Math.round(allPenalties.reduce((sum, p) => sum + Math.abs(p.points), 0) * 10) / 10;
    return {
        url: page.url,
        overallScore,
        categoryScores,
        totalPenalties,
        grade,
        recommendations,
    };
}
/**
 * Calculate site-level penalties using proportional/logarithmic approach
 */
function calculateSiteLevelPenalties(pages, _pageScores) {
    const details = [];
    let totalPenaltyPercentage = 0;
    const totalPages = pages.length;
    if (totalPages === 0) {
        return { penaltyPercentage: 0, details: [] };
    }
    // Helper to calculate logarithmic penalty
    const logPenalty = (affectedPercentage, maxPenalty) => {
        // Use log scale: penalty = maxPenalty × log(1 + affected%) / log(2)
        // This means 50% affected = ~80% of max penalty, 100% affected = 100% of max penalty
        return maxPenalty * (Math.log(1 + affectedPercentage) / Math.log(2));
    };
    // CRITICAL ISSUES (5-15% penalty)
    const httpPages = pages.filter(p => !p.security?.isHttps).length;
    const httpPercentage = (httpPages / totalPages) * 100;
    if (httpPercentage > 10) {
        const penalty = logPenalty(httpPercentage / 100, 0.15);
        totalPenaltyPercentage += penalty;
        details.push({
            type: 'critical',
            issue: 'Non-HTTPS pages',
            affectedPercentage: httpPercentage,
            penaltyPercentage: penalty * 100,
            description: `${httpPages} pages (${httpPercentage.toFixed(1)}%) served over HTTP`,
        });
    }
    const brokenPages = pages.filter(p => p.status === 404).length;
    const brokenPercentage = (brokenPages / totalPages) * 100;
    if (brokenPercentage > 5) {
        const penalty = logPenalty(brokenPercentage / 100, 0.12);
        totalPenaltyPercentage += penalty;
        details.push({
            type: 'critical',
            issue: 'Broken pages (404)',
            affectedPercentage: brokenPercentage,
            penaltyPercentage: penalty * 100,
            description: `${brokenPages} pages (${brokenPercentage.toFixed(1)}%) return 404 errors`,
        });
    }
    // HIGH IMPACT ISSUES (3-8% penalty)
    const nonIndexablePages = pages.filter(p => p.indexability && !p.indexability.isIndexable).length;
    const nonIndexablePercentage = (nonIndexablePages / totalPages) * 100;
    if (nonIndexablePercentage > 15) {
        const penalty = logPenalty(nonIndexablePercentage / 100, 0.08);
        totalPenaltyPercentage += penalty;
        details.push({
            type: 'high',
            issue: 'Non-indexable pages',
            affectedPercentage: nonIndexablePercentage,
            penaltyPercentage: penalty * 100,
            description: `${nonIndexablePages} pages (${nonIndexablePercentage.toFixed(1)}%) marked non-indexable`,
        });
    }
    const duplicatePages = pages.filter(p => p.issues.some(i => i.message.toLowerCase().includes('duplicate'))).length;
    const duplicatePercentage = (duplicatePages / totalPages) * 100;
    if (duplicatePercentage > 20) {
        const penalty = logPenalty(duplicatePercentage / 100, 0.06);
        totalPenaltyPercentage += penalty;
        details.push({
            type: 'high',
            issue: 'Duplicate content',
            affectedPercentage: duplicatePercentage,
            penaltyPercentage: penalty * 100,
            description: `${duplicatePages} pages (${duplicatePercentage.toFixed(1)}%) have duplicate content`,
        });
    }
    // MEDIUM IMPACT ISSUES (1-5% penalty)
    const orphanPages = pages.filter(p => p.linkQuality?.isOrphan).length;
    const orphanPercentage = (orphanPages / totalPages) * 100;
    if (orphanPercentage > 15) {
        const penalty = logPenalty(orphanPercentage / 100, 0.05);
        totalPenaltyPercentage += penalty;
        details.push({
            type: 'medium',
            issue: 'Orphan pages',
            affectedPercentage: orphanPercentage,
            penaltyPercentage: penalty * 100,
            description: `${orphanPages} pages (${orphanPercentage.toFixed(1)}%) have no internal inlinks`,
        });
    }
    const thinPages = pages.filter(p => (p.contentMetrics?.wordCount ?? 0) < 300).length;
    const thinPercentage = (thinPages / totalPages) * 100;
    if (thinPercentage > 30) {
        const penalty = logPenalty(thinPercentage / 100, 0.04);
        totalPenaltyPercentage += penalty;
        details.push({
            type: 'medium',
            issue: 'Thin content',
            affectedPercentage: thinPercentage,
            penaltyPercentage: penalty * 100,
            description: `${thinPages} pages (${thinPercentage.toFixed(1)}%) have less than 300 words`,
        });
    }
    const noMetaDesc = pages.filter(p => !p.metaDescription).length;
    const noMetaDescPercentage = (noMetaDesc / totalPages) * 100;
    if (noMetaDescPercentage > 25) {
        const penalty = logPenalty(noMetaDescPercentage / 100, 0.03);
        totalPenaltyPercentage += penalty;
        details.push({
            type: 'medium',
            issue: 'Missing meta descriptions',
            affectedPercentage: noMetaDescPercentage,
            penaltyPercentage: penalty * 100,
            description: `${noMetaDesc} pages (${noMetaDescPercentage.toFixed(1)}%) missing meta descriptions`,
        });
    }
    // ARCHITECTURAL ISSUES (informational, 0-2% penalty)
    // These are often site-wide patterns that don't necessarily indicate poor SEO
    const lowContentRatio = pages.filter(p => (p.contentQuality?.contentToCodeRatio ?? 1) < 0.05).length;
    const lowContentRatioPercentage = (lowContentRatio / totalPages) * 100;
    if (lowContentRatioPercentage > 80) {
        // Only penalize if it's extremely widespread AND combined with other issues
        const hasOtherIssues = details.length > 0;
        const penalty = hasOtherIssues ? 0.02 : 0.01;
        totalPenaltyPercentage += penalty;
        details.push({
            type: 'architectural',
            issue: 'Low content-to-code ratio',
            affectedPercentage: lowContentRatioPercentage,
            penaltyPercentage: penalty * 100,
            description: `${lowContentRatio} pages (${lowContentRatioPercentage.toFixed(1)}%) have content-to-code ratio below 5% (likely architectural)`,
        });
    }
    const missingSecurityHeaders = pages.filter(p => {
        const sec = p.security;
        if (!sec)
            return false;
        const missing = [!sec.hasHsts, !sec.hasCsp, !sec.hasXFrameOptions, !sec.hasXContentTypeOptions].filter(Boolean).length;
        return missing >= 3;
    }).length;
    const missingSecurityPercentage = (missingSecurityHeaders / totalPages) * 100;
    if (missingSecurityPercentage > 90) {
        // Site-wide architectural decision, minimal penalty
        totalPenaltyPercentage += 0.01;
        details.push({
            type: 'architectural',
            issue: 'Missing security headers',
            affectedPercentage: missingSecurityPercentage,
            penaltyPercentage: 1,
            description: `${missingSecurityHeaders} pages (${missingSecurityPercentage.toFixed(1)}%) missing 3+ security headers (site-wide configuration)`,
        });
    }
    // Cap total penalty at 40% (never reduce score by more than 40%)
    totalPenaltyPercentage = Math.min(totalPenaltyPercentage, 0.40);
    return { penaltyPercentage: totalPenaltyPercentage, details };
}
export function calculateSiteScore(pages, pageScores, sitemapInfo) {
    if (pageScores.length === 0) {
        return {
            overallScore: 0,
            averagePageScore: 0,
            medianPageScore: 0,
            topPagesScore: 0,
            technicalHealthScore: 0,
            siteLevelPenalties: 0,
            baseScoreBeforePenalties: 0,
            totalPenaltyPercentage: 0,
            penaltyDetails: [],
            distribution: { excellent: 0, good: 0, fair: 0, needsImprovement: 0, poor: 0, critical: 0 },
            categoryAverages: { technical: 0, content: 0, onPage: 0, links: 0, security: 0, performance: 0 },
            totalPages: pages.length,
            indexablePages: 0,
            percentageWithoutErrors: 0,
            uniqueIssueTypes: 0,
            topIssues: [],
            segments: [],
            bestPages: [],
            worstPages: [],
        };
    }
    const indexablePages = pages.filter(p => p.status === 200 && (!p.indexability || p.indexability.isIndexable));
    const averagePageScore = pageScores.reduce((sum, ps) => sum + ps.overallScore, 0) / pageScores.length;
    const sortedScores = [...pageScores].sort((a, b) => a.overallScore - b.overallScore);
    const mid = Math.floor(sortedScores.length / 2);
    const medianPageScore = sortedScores.length % 2 === 0
        ? (sortedScores[mid - 1].overallScore + sortedScores[mid].overallScore) / 2
        : sortedScores[mid].overallScore;
    const sortedByInlinks = [...pageScores].sort((a, b) => {
        const pageA = pages.find(p => p.url === a.url);
        const pageB = pages.find(p => p.url === b.url);
        return (pageB?.linkQuality?.inlinkCount || 0) - (pageA?.linkQuality?.inlinkCount || 0);
    });
    const topCount = Math.max(1, Math.floor(sortedByInlinks.length * 0.2));
    const topPages = sortedByInlinks.slice(0, topCount);
    const topPagesScore = topPages.reduce((sum, ps) => sum + ps.overallScore, 0) / topCount;
    let sitemapCoverage = sitemapInfo ? (sitemapInfo.urlsInSitemap.size / Math.max(1, pages.length)) * 100 : 100;
    if (Number.isNaN(sitemapCoverage))
        sitemapCoverage = 100;
    const indexabilityRate = (indexablePages.length / Math.max(1, pages.length)) * 100;
    const technicalHealthScore = (sitemapCoverage + indexabilityRate) / 2;
    // Calculate site-level penalties using new proportional system
    const { penaltyPercentage, details: penaltyDetails } = calculateSiteLevelPenalties(pages, pageScores);
    const siteLevelPenalties = penaltyPercentage * 100; // Convert to points for backwards compatibility
    const distribution = {
        excellent: pageScores.filter(p => p.overallScore >= 90).length,
        good: pageScores.filter(p => p.overallScore >= 80 && p.overallScore < 90).length,
        fair: pageScores.filter(p => p.overallScore >= 70 && p.overallScore < 80).length,
        needsImprovement: pageScores.filter(p => p.overallScore >= 50 && p.overallScore < 70).length,
        poor: pageScores.filter(p => p.overallScore >= 30 && p.overallScore < 50).length,
        critical: pageScores.filter(p => p.overallScore < 30).length,
    };
    const pagesWithoutCriticalErrors = pageScores.filter(ps => ps.categoryScores.technical.penalties.every(p => p.severity !== 'high') &&
        ps.categoryScores.content.penalties.every(p => p.severity !== 'high')).length;
    const percentageWithoutErrors = (pagesWithoutCriticalErrors / Math.max(1, pages.length)) * 100;
    const uniqueIssues = new Set();
    pageScores.forEach(ps => {
        Object.values(ps.categoryScores).forEach(cs => {
            cs.penalties.forEach(penalty => {
                if (penalty.severity === 'high')
                    uniqueIssues.add(`${penalty.category}:${penalty.issue}`);
            });
        });
    });
    const uniqueIssueTypes = uniqueIssues.size;
    // Calculate base score (before site-level penalties)
    const baseScore = averagePageScore * 0.70 + topPagesScore * 0.20 + technicalHealthScore * 0.10;
    // Apply penalties as percentage reduction (multiplicative)
    // This ensures score degradation is proportional, not absolute
    const overallScore = clampScore(baseScore * (1 - penaltyPercentage));
    // Ensure floor: never drop below 60% of base score for excellent page averages
    const floor = averagePageScore >= 85 ? baseScore * 0.60 : 0;
    const finalScore = clampScore(Math.max(overallScore, floor));
    const categoryAverages = {
        technical: clampScore(avg(pageScores.map(p => p.categoryScores.technical.score))),
        content: clampScore(avg(pageScores.map(p => p.categoryScores.content.score))),
        onPage: clampScore(avg(pageScores.map(p => p.categoryScores.onPage.score))),
        links: clampScore(avg(pageScores.map(p => p.categoryScores.links.score))),
        security: clampScore(avg(pageScores.map(p => p.categoryScores.security.score))),
        performance: clampScore(avg(pageScores.map(p => p.categoryScores.performance.score))),
    };
    const issueMap = new Map();
    pageScores.forEach(ps => {
        Object.values(ps.categoryScores).forEach(cs => {
            cs.penalties.forEach(penalty => {
                const key = `${penalty.category}:${penalty.issue}`;
                const existing = issueMap.get(key);
                const impact = Math.abs(penalty.points);
                if (existing) {
                    existing.count += 1;
                    existing.totalImpact += impact;
                }
                else {
                    issueMap.set(key, { count: 1, totalImpact: impact, category: penalty.category });
                }
            });
        });
    });
    const topIssues = Array.from(issueMap.entries())
        .map(([key, data]) => {
        const [, issue] = key.split(':');
        return {
            issue,
            affectedPages: data.count,
            percentageAffected: (data.count / Math.max(1, pages.length)) * 100,
            averageImpact: data.totalImpact / Math.max(1, data.count),
            category: data.category,
        };
    })
        .sort((a, b) => (b.affectedPages * b.averageImpact) - (a.affectedPages * a.averageImpact))
        .slice(0, 10);
    const segments = calculateSegmentScores(pages, pageScores);
    return {
        overallScore: finalScore,
        averagePageScore: clampScore(averagePageScore),
        medianPageScore: clampScore(medianPageScore),
        topPagesScore: clampScore(topPagesScore),
        technicalHealthScore: clampScore(technicalHealthScore),
        siteLevelPenalties: Math.round(siteLevelPenalties * 10) / 10,
        baseScoreBeforePenalties: clampScore(baseScore),
        totalPenaltyPercentage: Math.round(penaltyPercentage * 1000) / 10, // Convert to percentage with 1 decimal
        penaltyDetails,
        distribution,
        categoryAverages,
        totalPages: pages.length,
        indexablePages: indexablePages.length,
        percentageWithoutErrors: clampScore(percentageWithoutErrors),
        uniqueIssueTypes,
        topIssues,
        segments,
        bestPages: [...pageScores].sort((a, b) => b.overallScore - a.overallScore).slice(0, 10),
        worstPages: sortedScores.slice(0, Math.min(10, sortedScores.length)),
    };
}
function calculateSegmentScores(_pages, pageScores) {
    const segments = new Map();
    pageScores.forEach(ps => {
        try {
            const url = new URL(ps.url);
            const segment = url.pathname.split('/').filter(Boolean)[0] || 'root';
            if (!segments.has(segment)) {
                segments.set(segment, []);
            }
            segments.get(segment).push(ps);
        }
        catch {
            // Ignore invalid URLs in segmentation
        }
    });
    return Array.from(segments.entries())
        .filter(([, scores]) => scores.length >= 5)
        .map(([name, scores]) => ({
        name,
        pattern: name === 'root' ? '/' : `/${name}/`,
        pages: scores.length,
        averageScore: clampScore(avg(scores.map(s => s.overallScore))),
        distribution: {
            excellent: scores.filter(s => s.overallScore >= 90).length,
            good: scores.filter(s => s.overallScore >= 80 && s.overallScore < 90).length,
            fair: scores.filter(s => s.overallScore >= 70 && s.overallScore < 80).length,
            needsImprovement: scores.filter(s => s.overallScore >= 50 && s.overallScore < 70).length,
            poor: scores.filter(s => s.overallScore >= 30 && s.overallScore < 50).length,
            critical: scores.filter(s => s.overallScore < 30).length,
        },
    }))
        .sort((a, b) => b.averageScore - a.averageScore);
}
function avg(values) {
    if (values.length === 0)
        return 0;
    const sum = values.reduce((total, value) => total + value, 0);
    return sum / values.length;
}
export function generateScoreHistogram(pageScores, bucketSize = 10) {
    if (pageScores.length === 0)
        return [];
    const buckets = [];
    for (let start = 0; start < 100; start += bucketSize) {
        const end = start + bucketSize - 1;
        const label = `${start}-${end === 99 ? 99 : end}`;
        buckets.push({ range: label, count: 0 });
    }
    // Include 100 in last bucket label
    const lastBucket = buckets[buckets.length - 1];
    if (lastBucket)
        lastBucket.range = lastBucket.range.replace(/\d+$/, '100');
    pageScores.forEach(score => {
        const value = Math.floor(score.overallScore);
        const index = Math.min(buckets.length - 1, Math.floor(value / bucketSize));
        buckets[index].count += 1;
    });
    return buckets;
}
export { DEFAULT_WEIGHTS };
//# sourceMappingURL=scorer.js.map