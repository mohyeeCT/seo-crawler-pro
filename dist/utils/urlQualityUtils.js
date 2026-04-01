/**
 * Utilities for URL quality analysis
 */
/**
 * Common tracking parameter names
 */
const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
    '_ga', '_gl', 'ref', 'source', 'campaign'
]);
/**
 * Checks if URL contains multiple consecutive slashes
 */
export function hasMultipleSlashes(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname.includes('//');
    }
    catch {
        return url.includes('//') && !url.startsWith('http://') && !url.startsWith('https://');
    }
}
/**
 * Checks if URL contains spaces
 */
export function hasSpaces(url) {
    return url.includes(' ') || url.includes('%20');
}
/**
 * Checks if URL contains non-ASCII characters
 */
export function hasNonAsciiCharacters(url) {
    try {
        const urlObj = new URL(url);
        // Check pathname (domain is already encoded)
        return /[^\x00-\x7F]/.test(decodeURIComponent(urlObj.pathname));
    }
    catch {
        return /[^\x00-\x7F]/.test(url);
    }
}
/**
 * Checks if URL contains uppercase letters (bad for consistency)
 */
export function hasUppercaseCharacters(url) {
    try {
        const urlObj = new URL(url);
        // Check pathname (ignore protocol and domain)
        return /[A-Z]/.test(urlObj.pathname);
    }
    catch {
        return /[A-Z]/.test(url);
    }
}
/**
 * Checks if URL has repetitive path segments (e.g., /blog/blog/post)
 */
export function hasRepetitivePaths(url) {
    try {
        const urlObj = new URL(url);
        const segments = urlObj.pathname.split('/').filter(s => s.length > 0);
        for (let i = 0; i < segments.length - 1; i++) {
            if (segments[i] === segments[i + 1]) {
                return true;
            }
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Checks if URL is fragment-only (e.g., #section)
 */
export function isFragmentOnly(url) {
    return url.trim().startsWith('#');
}
/**
 * Extracts query parameters from URL
 */
export function extractQueryParams(url) {
    try {
        const urlObj = new URL(url);
        const params = {};
        urlObj.searchParams.forEach((value, key) => {
            params[key] = value;
        });
        return params;
    }
    catch {
        return {};
    }
}
/**
 * Checks if URL has tracking parameters
 */
export function hasTrackingParams(url) {
    try {
        const urlObj = new URL(url);
        for (const key of urlObj.searchParams.keys()) {
            if (TRACKING_PARAMS.has(key.toLowerCase())) {
                return true;
            }
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Checks if URL appears to be an internal search or filter URL
 */
export function isInternalSearchUrl(url) {
    try {
        const urlObj = new URL(url);
        const params = urlObj.searchParams;
        const pathname = urlObj.pathname.toLowerCase();
        // Check for common search/filter parameters
        const searchParams = ['q', 'query', 'search', 's', 'keyword', 'filter', 'sort', 'page'];
        for (const param of searchParams) {
            if (params.has(param)) {
                return true;
            }
        }
        // Check for search in pathname
        return pathname.includes('/search') || pathname.includes('/filter');
    }
    catch {
        return false;
    }
}
export function analyzeUrlQuality(url) {
    const issues = [];
    const analysis = {
        hasMultipleSlashes: false,
        hasSpaces: false,
        hasNonAscii: false,
        hasUppercase: false,
        hasRepetitivePaths: false,
        urlLength: url.length,
        hasQueryParams: false,
        hasTrackingParams: false,
        hasFragmentOnly: false,
        queryParams: {},
        issues: [],
    };
    // Check multiple slashes
    if (hasMultipleSlashes(url)) {
        analysis.hasMultipleSlashes = true;
        issues.push('URL contains multiple consecutive slashes');
    }
    // Check spaces
    if (hasSpaces(url)) {
        analysis.hasSpaces = true;
        issues.push('URL contains spaces');
    }
    // Check non-ASCII
    if (hasNonAsciiCharacters(url)) {
        analysis.hasNonAscii = true;
        issues.push('URL contains non-ASCII characters');
    }
    // Check uppercase
    if (hasUppercaseCharacters(url)) {
        analysis.hasUppercase = true;
        issues.push('URL contains uppercase characters');
    }
    // Check repetitive paths
    if (hasRepetitivePaths(url)) {
        analysis.hasRepetitivePaths = true;
        issues.push('URL contains repetitive path segments');
    }
    // Check URL length (Google's limit is ~2083 characters)
    if (url.length > 2083) {
        issues.push(`URL too long (${url.length} chars, max recommended: 2083)`);
    }
    else if (url.length > 100) {
        issues.push(`URL quite long (${url.length} chars, recommended: <100)`);
    }
    // Check fragment only
    if (isFragmentOnly(url)) {
        analysis.hasFragmentOnly = true;
        issues.push('URL is fragment-only');
    }
    // Extract and analyze query params
    analysis.queryParams = extractQueryParams(url);
    analysis.hasQueryParams = Object.keys(analysis.queryParams).length > 0;
    if (hasTrackingParams(url)) {
        analysis.hasTrackingParams = true;
        issues.push('URL contains tracking parameters');
    }
    if (isInternalSearchUrl(url)) {
        issues.push('URL appears to be an internal search or filter URL');
    }
    analysis.issues = issues;
    return analysis;
}
//# sourceMappingURL=urlQualityUtils.js.map