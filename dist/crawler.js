import axios from 'axios';
import { load as loadDom } from './utils/domLite.js';
import pLimit from 'p-limit';
import { normalizeUrl, resolveUrl, isInternalLink, isHtmlContent, isSameDomain, isBareExternalDomain, } from './utils/urlUtils.js';
import { fetchRobotsTxt, isAllowedByRobots, getCrawlDelay } from './robotsParser.js';
import { autoDetectSitemap, fetchSitemap } from './sitemapAnalyzer.js';
import { createLogger } from './utils/logger.js';
import { createStealthConfig, calculateStealthDelay, StealthSession, } from './utils/stealthUtils.js';
/**
 * Crawls a website starting from the given URL
 * Uses breadth-first search with configurable concurrency
 */
export async function crawlSite(config, onProgress) {
    const results = [];
    const visitedUrls = new Set();
    const queue = [];
    const logger = createLogger(config.debugLog ? (config.logFile || `${config.output}/crawl-debug-${Date.now()}.log`) : undefined);
    // Initialize stealth configuration
    const stealthConfig = config.stealth ? createStealthConfig(config.stealth) : createStealthConfig({ enabled: false });
    const stealthSession = new StealthSession(stealthConfig);
    // Normalize and add starting URL to queue
    const startUrl = normalizeUrl(config.url);
    await logger.info(`START crawl url=${startUrl} depth=${config.depth} maxPages=${config.maxPages} concurrency=${config.concurrency}`);
    // Fetch and parse robots.txt
    let robotsInfo = null;
    if (config.respectRobotsTxt !== false) {
        robotsInfo = await fetchRobotsTxt(startUrl, config.userAgent);
    }
    // Fetch sitemap URLs if needed
    const crawlMode = config.crawlMode || 'both';
    let sitemapUrls = [];
    if (crawlMode === 'sitemap' || crawlMode === 'both') {
        try {
            const robotsSitemaps = robotsInfo?.info.sitemaps || [];
            let sitemapSources = [];
            if (config.sitemapUrl) {
                sitemapSources = [config.sitemapUrl];
            }
            else {
                sitemapSources = await autoDetectSitemap(config.url, robotsSitemaps, config.userAgent);
            }
            for (const sitemapUrl of sitemapSources) {
                const urls = await fetchSitemap(sitemapUrl, config.userAgent);
                sitemapUrls.push(...urls);
                await logger.info(`SITEMAP source=${sitemapUrl} urls=${urls.length}`);
            }
        }
        catch (error) {
            console.warn(`Failed to fetch sitemap: ${error.message}`);
            await logger.warn(`SITEMAP error=${error.message}`);
        }
    }
    // Initialize queue based on crawl mode
    if (crawlMode === 'crawl') {
        // Only add starting URL for link-based crawling
        queue.push({ url: startUrl, depth: 0 });
        visitedUrls.add(startUrl);
        await logger.debug(`ENQUEUE initial url=${startUrl} depth=0`);
    }
    else if (crawlMode === 'sitemap') {
        // Only add sitemap URLs
        for (const url of sitemapUrls) {
            const normalized = normalizeUrl(url);
            if (!visitedUrls.has(normalized) && isInternalLink(normalized, config.url)) {
                visitedUrls.add(normalized);
                queue.push({ url: normalized, depth: 0 });
                await logger.debug(`ENQUEUE sitemap url=${normalized} depth=0`);
            }
        }
    }
    else {
        // Both: add starting URL and sitemap URLs
        queue.push({ url: startUrl, depth: 0 });
        visitedUrls.add(startUrl);
        await logger.debug(`ENQUEUE initial url=${startUrl} depth=0`);
        for (const url of sitemapUrls) {
            const normalized = normalizeUrl(url);
            if (!visitedUrls.has(normalized) && isInternalLink(normalized, config.url)) {
                visitedUrls.add(normalized);
                queue.push({ url: normalized, depth: 0 });
                await logger.debug(`ENQUEUE sitemap url=${normalized} depth=0`);
            }
        }
    }
    // Setup concurrency control
    const limit = pLimit(config.concurrency);
    // Process queue in batches
    while (queue.length > 0 && results.length < config.maxPages) {
        // Take a batch of URLs to process
        const batchSize = Math.min(config.concurrency, queue.length, config.maxPages - results.length);
        const batch = queue.splice(0, batchSize);
        // Process batch concurrently
        const promises = batch.map(item => limit(() => fetchAndExtractLinks(item, config, visitedUrls, queue, results, robotsInfo, stealthSession, onProgress, logger)));
        await Promise.all(promises);
        // Small delay for politeness (or respect crawl-delay)
        if (queue.length > 0) {
            const baseDelayMs = robotsInfo ? getCrawlDelay(robotsInfo.info) : 100;
            const stealthDelayMs = calculateStealthDelay(stealthConfig, baseDelayMs);
            await delay(Math.max(stealthDelayMs, baseDelayMs));
        }
    }
    await logger.info(`END crawl pages=${results.length}`);
    return results;
}
/**
 * Fetches a page and extracts links from it
 */
async function fetchAndExtractLinks(item, config, visitedUrls, queue, results, robotsInfo, stealthSession, onProgress, logger) {
    const { url, depth } = item;
    // Check if URL is allowed by robots.txt
    if (robotsInfo && !isAllowedByRobots(robotsInfo.parser, url)) {
        robotsInfo.info.blockedUrls.push(url);
        if (logger)
            await logger.info(`SKIP robots url=${url}`);
        return;
    }
    const startTime = Date.now();
    const redirectChain = [];
    let currentUrl = url;
    try {
        // Create base request config
        const baseRequestConfig = {
            timeout: config.timeout,
            headers: {
                'User-Agent': config.userAgent,
            },
            maxRedirects: 5,
            validateStatus: (status) => status < 500, // Accept 4xx responses
            // Track redirects and prevent following external ones
            beforeRedirect: (_options, responseDetails) => {
                // Only track actual HTTP redirects (3xx status codes)
                if (responseDetails.status >= 300 && responseDetails.status < 400) {
                    const location = responseDetails.headers?.location;
                    let toUrl = currentUrl;
                    if (location) {
                        try {
                            toUrl = new URL(location, currentUrl).toString();
                        }
                        catch {
                            toUrl = location;
                        }
                    }
                    // Check if redirect goes to external domain
                    if (!isInternalLink(toUrl, config.url)) {
                        // Stop following this redirect chain by throwing an error
                        const error = new Error('External redirect detected');
                        error.isExternalRedirect = true;
                        error.externalUrl = toUrl;
                        throw error;
                    }
                    redirectChain.push({
                        from: currentUrl,
                        to: toUrl,
                        status: responseDetails.status,
                    });
                    if (logger)
                        logger.info(`REDIRECT from=${currentUrl} to=${toUrl} status=${responseDetails.status}`);
                    currentUrl = toUrl; // Update current URL for next redirect in chain
                }
            },
        };
        // Apply stealth configuration to the request
        const stealthRequestConfig = stealthSession.createRequestConfig(baseRequestConfig);
        // Fetch the page with stealth configuration
        const response = await axios.get(url, stealthRequestConfig);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const htmlRaw = response.data;
        const status = response.status;
        const headers = {};
        // Capture response headers
        if (response.headers) {
            for (const [key, value] of Object.entries(response.headers)) {
                if (typeof value === 'string') {
                    headers[key] = value;
                }
                else if (Array.isArray(value)) {
                    headers[key] = value.join(', ');
                }
            }
        }
        const htmlString = typeof htmlRaw === 'string' ? htmlRaw : String(htmlRaw);
        // Determine final URL after redirects
        let fallbackFinalUrl;
        try {
            const reqAny = response?.request;
            const resAny = reqAny?.res;
            if (resAny?.responseUrl) {
                fallbackFinalUrl = resAny.responseUrl;
            }
            else if (reqAny?.protocol && reqAny?.host && reqAny?.path) {
                // Construct from request parts if available
                fallbackFinalUrl = `${reqAny.protocol}//${reqAny.host}${reqAny.path}`;
            }
        }
        catch { }
        const finalUrl = fallbackFinalUrl || currentUrl;
        // Check if we redirected to an external domain - if so, don't store this page
        if (!isInternalLink(finalUrl, config.url)) {
            // This URL redirected externally - skip storing it
            if (onProgress) {
                onProgress(results.length, config.maxPages, url, status);
            }
            return;
        }
        // If beforeRedirect did not fire but final URL differs from original, synthesize a redirect hop
        if (redirectChain.length === 0 && finalUrl && finalUrl !== url && !isSameDomain(finalUrl, url)) {
            redirectChain.push({ from: url, to: finalUrl, status: 0 });
            if (logger)
                await logger.info(`REDIRECT(inferred) from=${url} to=${finalUrl} status=unknown`);
        }
        // Determine if redirect chain ended on a different domain (cross-domain)
        const crossDomainRedirect = !isSameDomain(finalUrl, config.url) && finalUrl !== url;
        if (logger) {
            if (redirectChain.length > 0) {
                await logger.info(`FETCH url=${url} final=${finalUrl} status=${status} crossDomain=${crossDomainRedirect}`);
            }
            else {
                await logger.info(`FETCH url=${url} status=${status}`);
            }
        }
        // Prefer last redirect status for cross-domain redirects
        const effectiveStatus = crossDomainRedirect && redirectChain.length > 0
            ? redirectChain[redirectChain.length - 1].status
            : status;
        // Use final URL for same-domain redirects so resolution is correct
        const pageUrlForResults = crossDomainRedirect ? url : finalUrl;
        // Store the page data with performance metrics
        results.push({
            url: pageUrlForResults,
            html: crossDomainRedirect ? '' : htmlString,
            status: effectiveStatus,
            depth,
            timestamp: Date.now(),
            responseTime,
            redirectChain,
            headers,
        });
        // Update progress if callback provided
        if (onProgress) {
            onProgress(results.length, config.maxPages, pageUrlForResults, effectiveStatus);
        }
        // Only extract links if:
        // 1. Crawl mode is not 'sitemap' (sitemap mode doesn't follow links)
        // 2. Status is 200 (successful)
        // 3. We haven't reached max depth
        // 4. Content-Type suggests HTML
        const crawlMode = config.crawlMode || 'both';
        const shouldExtractLinks = crawlMode !== 'sitemap';
        const contentType = response.headers['content-type'] || '';
        const isHtml = contentType.includes('text/html');
        if (shouldExtractLinks && status === 200 && isHtml && depth < config.depth && !crossDomainRedirect) {
            // Use final URL as base when resolving links after same-domain redirects
            extractLinks(htmlString, finalUrl, depth, config, visitedUrls, queue, logger);
            if (logger)
                await logger.debug(`EXTRACT url=${finalUrl} depth=${depth} queueSize=${queue.length}`);
        }
        else if (crossDomainRedirect) {
            if (logger)
                await logger.info(`SKIP_ANALYZE cross-domain url=${url} final=${finalUrl}`);
        }
    }
    catch (error) {
        // Handle external redirect errors specifically
        if (error.isExternalRedirect) {
            // This URL redirects to external domain - skip storing it entirely
            if (onProgress) {
                onProgress(results.length, config.maxPages, url, 0);
            }
            return;
        }
        // Continue crawling on other errors
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const status = error.response?.status || 0;
        // Check if this error happened after redirecting to an external domain
        const finalUrl = currentUrl || url;
        if (!isInternalLink(finalUrl, config.url)) {
            // This URL redirected externally and then failed - skip storing it
            if (onProgress) {
                onProgress(results.length, config.maxPages, url, status);
            }
            return;
        }
        // Still add to results with error info (only for internal URLs)
        results.push({
            url,
            html: '',
            status,
            depth,
            timestamp: Date.now(),
            responseTime,
            redirectChain,
            headers: {},
        });
        // Update progress if callback provided
        if (onProgress) {
            onProgress(results.length, config.maxPages, url, status);
        }
        if (logger)
            await logger.error(`ERROR url=${url} status=${status} message=${error.message || 'unknown'}`);
    }
}
/**
 * Extracts and queues internal links from HTML content
 */
function extractLinks(html, baseUrl, currentDepth, config, visitedUrls, queue, logger) {
    try {
        const $ = loadDom(html);
        // Find all links
        $('a[href]').each((_, element) => {
            const href = $(element).attr('href');
            if (!href)
                return;
            // Skip bare external domains (e.g., "facebook.com") to prevent treating them as relative
            if (isBareExternalDomain(href)) {
                return;
            }
            // Resolve relative URLs
            const absoluteUrl = resolveUrl(href, baseUrl);
            // Normalize the URL
            const normalizedUrl = normalizeUrl(absoluteUrl);
            // Check if we should crawl this URL
            if (!visitedUrls.has(normalizedUrl) &&
                isInternalLink(normalizedUrl, config.url) &&
                isHtmlContent(normalizedUrl)) {
                visitedUrls.add(normalizedUrl);
                queue.push({
                    url: normalizedUrl,
                    depth: currentDepth + 1,
                });
                if (logger)
                    logger.debug(`ENQUEUE link url=${normalizedUrl} depth=${currentDepth + 1}`).catch(() => { });
            }
        });
    }
    catch (error) {
        console.error(`Failed to extract links from ${baseUrl}: ${error.message}`);
    }
}
/**
 * Simple delay utility
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=crawler.js.map