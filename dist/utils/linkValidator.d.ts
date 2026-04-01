/**
 * Utilities for validating links and following redirect chains
 */
export interface RedirectChain {
    from: string;
    to: string;
    status: number;
}
export interface LinkValidationResult {
    finalUrl: string;
    status: number;
    isReachable: boolean;
    isInternalFinal: boolean;
    redirectChain: RedirectChain[];
    error?: string;
}
/**
 * Validates a link by following redirect chains and determining final status
 */
export declare function validateLink(url: string, baseUrl: string, userAgent?: string, maxRedirects?: number): Promise<LinkValidationResult>;
/**
 * Checks if a URL redirects to an external domain
 */
export declare function redirectsToExternal(url: string, baseUrl: string, userAgent?: string): Promise<boolean>;
/**
 * Batch validate multiple links with concurrency control
 */
export declare function validateLinks(urls: string[], baseUrl: string, userAgent?: string, concurrency?: number): Promise<Map<string, LinkValidationResult>>;
/**
 * Checks if a URL matches common patterns that often redirect externally
 */
export declare function isLikelyExternalRedirect(url: string): boolean;
/**
 * Pre-validates links that are likely to redirect externally
 * Returns updated link data with proper internal/external classification
 */
export declare function preValidateRedirectLinks(links: Array<{
    href: string;
    isInternal: boolean;
    [key: string]: any;
}>, baseUrl: string, userAgent?: string): Promise<Array<{
    href: string;
    isInternal: boolean;
    finalUrl?: string;
    redirectsExternally?: boolean;
    [key: string]: any;
}>>;
//# sourceMappingURL=linkValidator.d.ts.map