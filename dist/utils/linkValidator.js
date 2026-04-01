/**
 * Utilities for validating links and following redirect chains
 */
import axios from 'axios';
import { normalizeUrl, isInternalLink } from './urlUtils.js';
/**
 * Validates a link by following redirect chains and determining final status
 */
export async function validateLink(url, baseUrl, userAgent = 'SEO-CommandLine-Tool/1.0', maxRedirects = 5) {
    const redirectChain = [];
    let currentUrl = url;
    let finalStatus = 0;
    let error;
    try {
        const response = await axios.head(url, {
            timeout: 5000,
            headers: {
                'User-Agent': userAgent,
            },
            maxRedirects,
            validateStatus: (status) => status < 500, // Accept 4xx and 3xx responses
            // Track redirects manually
            beforeRedirect: (options, responseDetails) => {
                if (responseDetails.status >= 300 && responseDetails.status < 400) {
                    const toUrl = responseDetails.headers?.location || options.url;
                    redirectChain.push({
                        from: currentUrl,
                        to: toUrl,
                        status: responseDetails.status,
                    });
                    currentUrl = toUrl;
                }
            },
        });
        finalStatus = response.status;
        // Update currentUrl to the final URL from the response
        currentUrl = response.request?.res?.responseUrl || currentUrl;
    }
    catch (err) {
        finalStatus = err.response?.status || 0;
        error = err.message;
        // Still track any redirects that occurred before the error
        if (err.response?.request?.res?.responseUrl) {
            currentUrl = err.response.request.res.responseUrl;
        }
    }
    const finalUrlNormalized = normalizeUrl(currentUrl);
    const isInternalFinal = isInternalLink(finalUrlNormalized, baseUrl);
    const isReachable = finalStatus >= 200 && finalStatus < 400;
    return {
        finalUrl: finalUrlNormalized,
        status: finalStatus,
        isReachable,
        isInternalFinal,
        redirectChain,
        error,
    };
}
/**
 * Checks if a URL redirects to an external domain
 */
export async function redirectsToExternal(url, baseUrl, userAgent = 'SEO-CommandLine-Tool/1.0') {
    try {
        const result = await validateLink(url, baseUrl, userAgent);
        // If there are redirects and the final URL is external, return true
        if (result.redirectChain.length > 0 && !result.isInternalFinal) {
            return true;
        }
        return false;
    }
    catch {
        // If validation fails, assume it doesn't redirect externally
        return false;
    }
}
/**
 * Batch validate multiple links with concurrency control
 */
export async function validateLinks(urls, baseUrl, userAgent = 'SEO-CommandLine-Tool/1.0', concurrency = 10) {
    const results = new Map();
    const limit = await import('p-limit').then(m => m.default(concurrency));
    const promises = urls.map(url => limit(async () => {
        const result = await validateLink(url, baseUrl, userAgent);
        results.set(url, result);
        return result;
    }));
    await Promise.allSettled(promises);
    return results;
}
/**
 * Common patterns for links that frequently redirect to external services
 */
const EXTERNAL_REDIRECT_PATTERNS = [
    /\/cookie-policy$/i,
    /\/privacy-policy$/i,
    /\/terms-of-service$/i,
    /\/terms-and-conditions$/i,
    /\/legal$/i,
    /\/gdpr$/i,
    /\/ccpa$/i,
    /\/data-protection$/i,
];
/**
 * Checks if a URL matches common patterns that often redirect externally
 */
export function isLikelyExternalRedirect(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        return EXTERNAL_REDIRECT_PATTERNS.some(pattern => pattern.test(pathname));
    }
    catch {
        return false;
    }
}
/**
 * Pre-validates links that are likely to redirect externally
 * Returns updated link data with proper internal/external classification
 */
export async function preValidateRedirectLinks(links, baseUrl, userAgent = 'SEO-CommandLine-Tool/1.0') {
    const suspiciousLinks = links.filter(link => link.isInternal && isLikelyExternalRedirect(link.href));
    if (suspiciousLinks.length === 0) {
        return links;
    }
    // Validate suspicious links in batches
    const validationResults = await validateLinks(suspiciousLinks.map(l => l.href), baseUrl, userAgent, 5 // Lower concurrency for validation
    );
    // Update link data based on validation results
    return links.map(link => {
        const validation = validationResults.get(link.href);
        if (validation) {
            return {
                ...link,
                isInternal: validation.isInternalFinal, // Update based on final destination
                finalUrl: validation.finalUrl,
                redirectsExternally: validation.redirectChain.length > 0 && !validation.isInternalFinal,
            };
        }
        return link;
    });
}
//# sourceMappingURL=linkValidator.js.map