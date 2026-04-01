/**
 * Advanced link analysis including orphan detection, anchor text quality, and link metrics
 */
/**
 * Weak anchor text patterns
 */
const WEAK_ANCHOR_PATTERNS = [
    /^click here$/i,
    /^here$/i,
    /^read more$/i,
    /^more$/i,
    /^link$/i,
    /^this$/i,
    /^page$/i,
    /^website$/i,
    /^click$/i,
    /^\s*$/, // Empty
    /^[^a-z0-9]{1,3}$/i, // Single character or punctuation
];
/**
 * Checks if anchor text is weak/generic
 */
function isWeakAnchorText(text) {
    const trimmed = text.trim();
    // Check against patterns
    for (const pattern of WEAK_ANCHOR_PATTERNS) {
        if (pattern.test(trimmed)) {
            return true;
        }
    }
    // Check if too short (less than 3 characters)
    if (trimmed.length < 3) {
        return true;
    }
    return false;
}
/**
 * Checks if URL is localhost or 127.0.0.1
 */
function isLocalhostUrl(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
    }
    catch {
        return false;
    }
}
/**
 * Analyzes link quality for a single page
 */
export function analyzeLinkQuality(page, inlinkMap) {
    const internalLinks = page.links.filter(l => l.isInternal);
    const externalLinks = page.links.filter(l => !l.isInternal);
    // Find weak anchor texts
    const weakAnchorTexts = page.links.filter(link => isWeakAnchorText(link.text));
    // Find localhost links
    const localhostLinks = page.links
        .filter(link => isLocalhostUrl(link.href))
        .map(link => link.href);
    // Get inlink count for this page
    const inlinkCount = inlinkMap.get(page.url) || 0;
    // Determine if orphan (no internal inlinks and not the homepage)
    const isOrphan = inlinkCount === 0 && page.depth > 0;
    return {
        hasOutlinks: page.links.length > 0,
        internalOutlinkCount: internalLinks.length,
        externalOutlinkCount: externalLinks.length,
        hasLocalhostLinks: localhostLinks.length > 0,
        localhostLinks,
        weakAnchorTexts,
        inlinkCount,
        isOrphan,
    };
}
/**
 * Builds a map of inlinks (how many internal links point to each URL)
 */
export function buildInlinkMap(pages) {
    const inlinkMap = new Map();
    // Initialize all pages with 0
    for (const page of pages) {
        inlinkMap.set(page.url, 0);
    }
    // Count inlinks
    for (const page of pages) {
        const internalLinks = page.links.filter(l => l.isInternal);
        for (const link of internalLinks) {
            const current = inlinkMap.get(link.href) || 0;
            inlinkMap.set(link.href, current + 1);
        }
    }
    return inlinkMap;
}
/**
 * Analyzes link quality for all pages
 */
export function analyzeLinkQualityForAllPages(pages) {
    // Build inlink map
    const inlinkMap = buildInlinkMap(pages);
    // Analyze each page
    for (const page of pages) {
        page.linkQuality = analyzeLinkQuality(page, inlinkMap);
        // Add issues based on link quality
        if (page.linkQuality.isOrphan) {
            page.issues.push({
                message: 'Orphan page (no internal links pointing to this page)',
                severity: 'medium',
            });
        }
        // Check for links that redirect externally
        const externalRedirectLinks = page.links.filter(link => link.redirectsExternally);
        if (externalRedirectLinks.length > 0) {
            page.issues.push({
                message: `${externalRedirectLinks.length} internal link(s) redirect to external domains`,
                severity: 'medium',
            });
        }
        if (!page.linkQuality.hasOutlinks && page.status === 200) {
            page.issues.push({
                message: 'Page has no outgoing links (dead end)',
                severity: 'low',
            });
        }
        if (page.linkQuality.internalOutlinkCount > 100) {
            page.issues.push({
                message: `High internal link count (${page.linkQuality.internalOutlinkCount} links)`,
                severity: 'low',
            });
        }
        if (page.linkQuality.externalOutlinkCount > 50) {
            page.issues.push({
                message: `High external link count (${page.linkQuality.externalOutlinkCount} links)`,
                severity: 'low',
            });
        }
        if (page.linkQuality.hasLocalhostLinks) {
            page.issues.push({
                message: `${page.linkQuality.localhostLinks.length} localhost link(s) detected`,
                severity: 'high',
            });
        }
        if (page.linkQuality.weakAnchorTexts.length > 0) {
            page.issues.push({
                message: `${page.linkQuality.weakAnchorTexts.length} link(s) with weak anchor text (e.g., "click here", "read more")`,
                severity: 'low',
            });
        }
    }
}
//# sourceMappingURL=linkAnalyzer.js.map