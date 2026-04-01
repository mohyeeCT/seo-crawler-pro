/**
 * Utilities for security analysis
 */
export interface SecurityHeaders {
    strictTransportSecurity?: string;
    contentSecurityPolicy?: string;
    xContentTypeOptions?: string;
    xFrameOptions?: string;
    referrerPolicy?: string;
    permissionsPolicy?: string;
}
/**
 * Extracts security headers from response headers
 */
export declare function extractSecurityHeaders(headers: Record<string, string>): SecurityHeaders;
/**
 * Checks if URL is HTTPS
 */
export declare function isHttps(url: string): boolean;
/**
 * Checks if a resource URL is insecure (HTTP) when loaded on an HTTPS page
 */
export declare function isMixedContent(pageUrl: string, resourceUrl: string): boolean;
/**
 * Checks if URL uses protocol-relative scheme (//example.com)
 */
export declare function isProtocolRelative(url: string): boolean;
/**
 * Validates HSTS header
 */
export declare function validateHsts(hstsHeader?: string): {
    valid: boolean;
    issues: string[];
};
/**
 * Validates CSP header
 */
export declare function validateCsp(cspHeader?: string): {
    valid: boolean;
    issues: string[];
};
/**
 * Validates X-Frame-Options header
 */
export declare function validateXFrameOptions(xfoHeader?: string): {
    valid: boolean;
    issues: string[];
};
/**
 * Validates X-Content-Type-Options header
 */
export declare function validateXContentTypeOptions(xctoHeader?: string): {
    valid: boolean;
    issues: string[];
};
/**
 * Gets security score (0-100) based on headers
 */
export declare function calculateSecurityScore(headers: SecurityHeaders): number;
//# sourceMappingURL=securityUtils.d.ts.map