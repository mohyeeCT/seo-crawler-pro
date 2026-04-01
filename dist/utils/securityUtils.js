/**
 * Utilities for security analysis
 */
/**
 * Extracts security headers from response headers
 */
export function extractSecurityHeaders(headers) {
    const securityHeaders = {};
    // Normalize header names (case-insensitive)
    const normalizedHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
        normalizedHeaders[key.toLowerCase()] = value;
    }
    securityHeaders.strictTransportSecurity = normalizedHeaders['strict-transport-security'];
    securityHeaders.contentSecurityPolicy = normalizedHeaders['content-security-policy'];
    securityHeaders.xContentTypeOptions = normalizedHeaders['x-content-type-options'];
    securityHeaders.xFrameOptions = normalizedHeaders['x-frame-options'];
    securityHeaders.referrerPolicy = normalizedHeaders['referrer-policy'];
    securityHeaders.permissionsPolicy = normalizedHeaders['permissions-policy'];
    return securityHeaders;
}
/**
 * Checks if URL is HTTPS
 */
export function isHttps(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'https:';
    }
    catch {
        return false;
    }
}
/**
 * Checks if a resource URL is insecure (HTTP) when loaded on an HTTPS page
 */
export function isMixedContent(pageUrl, resourceUrl) {
    try {
        const pageProtocol = new URL(pageUrl).protocol;
        const resourceProtocol = new URL(resourceUrl).protocol;
        return pageProtocol === 'https:' && resourceProtocol === 'http:';
    }
    catch {
        return false;
    }
}
/**
 * Checks if URL uses protocol-relative scheme (//example.com)
 */
export function isProtocolRelative(url) {
    return url.trim().startsWith('//');
}
/**
 * Validates HSTS header
 */
export function validateHsts(hstsHeader) {
    if (!hstsHeader) {
        return { valid: false, issues: ['HSTS header missing'] };
    }
    const issues = [];
    const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/i);
    if (!maxAgeMatch) {
        issues.push('HSTS missing max-age directive');
    }
    else {
        const maxAge = parseInt(maxAgeMatch[1]);
        if (maxAge < 31536000) { // Less than 1 year
            issues.push(`HSTS max-age too short (${maxAge} seconds, recommended: 31536000)`);
        }
    }
    if (!hstsHeader.includes('includeSubDomains')) {
        issues.push('HSTS missing includeSubDomains directive (recommended)');
    }
    return { valid: issues.length === 0, issues };
}
/**
 * Validates CSP header
 */
export function validateCsp(cspHeader) {
    if (!cspHeader) {
        return { valid: false, issues: ['CSP header missing'] };
    }
    const issues = [];
    // Check for unsafe directives
    if (cspHeader.includes("'unsafe-inline'")) {
        issues.push("CSP uses 'unsafe-inline' (security risk)");
    }
    if (cspHeader.includes("'unsafe-eval'")) {
        issues.push("CSP uses 'unsafe-eval' (security risk)");
    }
    // Check for basic directives
    if (!cspHeader.includes('default-src')) {
        issues.push('CSP missing default-src directive');
    }
    return { valid: issues.length === 0, issues };
}
/**
 * Validates X-Frame-Options header
 */
export function validateXFrameOptions(xfoHeader) {
    if (!xfoHeader) {
        return { valid: false, issues: ['X-Frame-Options header missing'] };
    }
    const normalized = xfoHeader.trim().toUpperCase();
    const validValues = ['DENY', 'SAMEORIGIN'];
    if (!validValues.includes(normalized) && !normalized.startsWith('ALLOW-FROM ')) {
        return { valid: false, issues: [`Invalid X-Frame-Options value: ${xfoHeader}`] };
    }
    return { valid: true, issues: [] };
}
/**
 * Validates X-Content-Type-Options header
 */
export function validateXContentTypeOptions(xctoHeader) {
    if (!xctoHeader) {
        return { valid: false, issues: ['X-Content-Type-Options header missing'] };
    }
    if (xctoHeader.trim().toLowerCase() !== 'nosniff') {
        return { valid: false, issues: [`Invalid X-Content-Type-Options value: ${xctoHeader} (expected: nosniff)`] };
    }
    return { valid: true, issues: [] };
}
/**
 * Gets security score (0-100) based on headers
 */
export function calculateSecurityScore(headers) {
    let score = 0;
    if (headers.strictTransportSecurity) {
        const hstsValidation = validateHsts(headers.strictTransportSecurity);
        score += hstsValidation.valid ? 25 : 10;
    }
    if (headers.contentSecurityPolicy) {
        const cspValidation = validateCsp(headers.contentSecurityPolicy);
        score += cspValidation.valid ? 25 : 10;
    }
    if (headers.xContentTypeOptions) {
        score += 15;
    }
    if (headers.xFrameOptions) {
        score += 15;
    }
    if (headers.referrerPolicy) {
        score += 10;
    }
    if (headers.permissionsPolicy) {
        score += 10;
    }
    return score;
}
//# sourceMappingURL=securityUtils.js.map