/**
 * Utilities for URL quality analysis
 */
/**
 * Checks if URL contains multiple consecutive slashes
 */
export declare function hasMultipleSlashes(url: string): boolean;
/**
 * Checks if URL contains spaces
 */
export declare function hasSpaces(url: string): boolean;
/**
 * Checks if URL contains non-ASCII characters
 */
export declare function hasNonAsciiCharacters(url: string): boolean;
/**
 * Checks if URL contains uppercase letters (bad for consistency)
 */
export declare function hasUppercaseCharacters(url: string): boolean;
/**
 * Checks if URL has repetitive path segments (e.g., /blog/blog/post)
 */
export declare function hasRepetitivePaths(url: string): boolean;
/**
 * Checks if URL is fragment-only (e.g., #section)
 */
export declare function isFragmentOnly(url: string): boolean;
/**
 * Extracts query parameters from URL
 */
export declare function extractQueryParams(url: string): Record<string, string>;
/**
 * Checks if URL has tracking parameters
 */
export declare function hasTrackingParams(url: string): boolean;
/**
 * Checks if URL appears to be an internal search or filter URL
 */
export declare function isInternalSearchUrl(url: string): boolean;
/**
 * Analyzes URL quality and returns issues
 */
export interface UrlQualityAnalysis {
    hasMultipleSlashes: boolean;
    hasSpaces: boolean;
    hasNonAscii: boolean;
    hasUppercase: boolean;
    hasRepetitivePaths: boolean;
    urlLength: number;
    hasQueryParams: boolean;
    hasTrackingParams: boolean;
    hasFragmentOnly: boolean;
    queryParams: Record<string, string>;
    issues: string[];
}
export declare function analyzeUrlQuality(url: string): UrlQualityAnalysis;
//# sourceMappingURL=urlQualityUtils.d.ts.map