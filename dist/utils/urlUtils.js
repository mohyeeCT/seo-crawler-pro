/**
 * Normalizes a URL by:
 * - Removing trailing slashes (except for root)
 * - Lowercasing the hostname
 * - Removing fragments (#)
 * - Ensuring consistent format
 */
export function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        // Lowercase hostname
        urlObj.hostname = urlObj.hostname.toLowerCase();
        // Remove fragment
        urlObj.hash = '';
        // Remove trailing slash from pathname (except for root)
        if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
            urlObj.pathname = urlObj.pathname.slice(0, -1);
        }
        return urlObj.toString();
    }
    catch (error) {
        // If URL parsing fails, return original
        return url;
    }
}
/**
 * Normalizes a URL for comparison purposes (more aggressive than normalizeUrl)
 * - Forces HTTPS protocol
 * - Removes www. prefix
 * - Removes trailing slashes
 * - Lowercases the entire URL
 * - Removes query parameters (optional)
 * - Removes fragments
 */
export function normalizeUrlForComparison(url, ignoreQueryParams = false) {
    try {
        const urlObj = new URL(url);
        // Force HTTPS (treat http and https as the same)
        urlObj.protocol = 'https:';
        // Remove www. prefix
        urlObj.hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
        // Remove fragment
        urlObj.hash = '';
        // Optionally remove query parameters
        if (ignoreQueryParams) {
            urlObj.search = '';
        }
        // Remove trailing slash from pathname (except for root)
        if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
            urlObj.pathname = urlObj.pathname.slice(0, -1);
        }
        // Return normalized URL (hostname is already lowercased above)
        // Note: We don't lowercase the entire URL because paths are case-sensitive per RFC 3986
        return urlObj.toString();
    }
    catch (error) {
        // If URL parsing fails, return original
        return url;
    }
}
/**
 * Resolves a relative URL to absolute using a base URL
 */
export function resolveUrl(href, baseUrl) {
    try {
        return new URL(href, baseUrl).toString();
    }
    catch (error) {
        return href;
    }
}
/**
 * Checks if two URLs are from the same domain
 * Handles www vs non-www as the same domain
 */
export function isSameDomain(url1, url2) {
    try {
        const urlObj1 = new URL(url1);
        const urlObj2 = new URL(url2);
        // Normalize hostnames by removing www.
        const host1 = urlObj1.hostname.toLowerCase().replace(/^www\./, '');
        const host2 = urlObj2.hostname.toLowerCase().replace(/^www\./, '');
        return host1 === host2;
    }
    catch (error) {
        return false;
    }
}
/**
 * Checks if a URL is internal (same domain as base)
 */
export function isInternalLink(url, baseUrl) {
    return isSameDomain(url, baseUrl);
}
/**
 * Checks if a URL likely points to HTML content
 * Returns false for known non-HTML file extensions
 */
export function isHtmlContent(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        // List of non-HTML extensions to skip
        const nonHtmlExtensions = [
            '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
            '.css', '.js', '.json', '.xml', '.zip', '.rar', '.tar', '.gz',
            '.mp4', '.avi', '.mov', '.mp3', '.wav', '.doc', '.docx',
            '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
            '.woff', '.woff2', '.ttf', '.eot', '.otf',
            '.ico', '.bmp', '.tiff', '.eps', '.ai', '.psd'
        ];
        // Check if URL ends with any non-HTML extension
        for (const ext of nonHtmlExtensions) {
            if (pathname.endsWith(ext)) {
                return false;
            }
        }
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Extracts the domain from a URL
 */
export function getDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.toLowerCase().replace(/^www\./, '');
    }
    catch (error) {
        return '';
    }
}
/**
 * Detects bare domain patterns in hrefs like "facebook.com" without protocol
 * Returns true when:
 *  - It does not start with protocol (http/https), slash, hash, or query
 *  - It looks like a domain (at least one dot, valid labels)
 */
export function isBareExternalDomain(href) {
    const trimmed = href.trim();
    // Exclude obvious non-bare cases
    if (/^(https?:\/\/|\/|#|\?)/i.test(trimmed)) {
        return false;
    }
    // Simple domain pattern: labels with letters/digits/hyphens separated by dots
    // Must contain at least one dot to avoid matching simple relative paths
    const domainPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
    return domainPattern.test(trimmed);
}
//# sourceMappingURL=urlUtils.js.map