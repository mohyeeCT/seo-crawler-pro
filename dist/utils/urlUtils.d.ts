/**
 * Normalizes a URL by:
 * - Removing trailing slashes (except for root)
 * - Lowercasing the hostname
 * - Removing fragments (#)
 * - Ensuring consistent format
 */
export declare function normalizeUrl(url: string): string;
/**
 * Normalizes a URL for comparison purposes (more aggressive than normalizeUrl)
 * - Forces HTTPS protocol
 * - Removes www. prefix
 * - Removes trailing slashes
 * - Lowercases the entire URL
 * - Removes query parameters (optional)
 * - Removes fragments
 */
export declare function normalizeUrlForComparison(url: string, ignoreQueryParams?: boolean): string;
/**
 * Resolves a relative URL to absolute using a base URL
 */
export declare function resolveUrl(href: string, baseUrl: string): string;
/**
 * Checks if two URLs are from the same domain
 * Handles www vs non-www as the same domain
 */
export declare function isSameDomain(url1: string, url2: string): boolean;
/**
 * Checks if a URL is internal (same domain as base)
 */
export declare function isInternalLink(url: string, baseUrl: string): boolean;
/**
 * Checks if a URL likely points to HTML content
 * Returns false for known non-HTML file extensions
 */
export declare function isHtmlContent(url: string): boolean;
/**
 * Extracts the domain from a URL
 */
export declare function getDomain(url: string): string;
/**
 * Detects bare domain patterns in hrefs like "facebook.com" without protocol
 * Returns true when:
 *  - It does not start with protocol (http/https), slash, hash, or query
 *  - It looks like a domain (at least one dot, valid labels)
 */
export declare function isBareExternalDomain(href: string): boolean;
//# sourceMappingURL=urlUtils.d.ts.map