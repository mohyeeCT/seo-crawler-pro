import { XMLParser } from 'fast-xml-parser';
import { normalizeUrlForComparison } from './utils/urlUtils.js';
import axios from 'axios';
/**
 * Fetches and parses XML sitemap
 */
export async function fetchSitemap(sitemapUrl, userAgent, isChildSitemap = false) {
    try {
        console.log(`Fetching sitemap from ${sitemapUrl}...`);
        const response = await axios.get(sitemapUrl, {
            timeout: 30000,
            headers: { 'User-Agent': userAgent },
            maxContentLength: 100 * 1024 * 1024, // 100MB max
        });
        const content = response.data;
        const contentLength = Buffer.byteLength(typeof content === 'string' ? content : JSON.stringify(content));
        if (contentLength > 50 * 1024 * 1024) {
            console.warn(`⚠️  Sitemap is very large (${(contentLength / 1024 / 1024).toFixed(2)}MB, max recommended: 50MB)`);
        }
        // Parse XML
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
        });
        const parsed = parser.parse(content);
        const urls = [];
        // Check if it's a sitemap index
        if (parsed.sitemapindex) {
            console.log('Detected sitemap index, fetching child sitemaps...');
            const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
                ? parsed.sitemapindex.sitemap
                : [parsed.sitemapindex.sitemap];
            // Recursively fetch child sitemaps
            for (const sitemap of sitemaps) {
                if (sitemap && sitemap.loc) {
                    const childUrls = await fetchSitemap(sitemap.loc, userAgent, true);
                    urls.push(...childUrls);
                }
            }
        }
        // Regular sitemap
        else if (parsed.urlset && parsed.urlset.url) {
            const urlEntries = Array.isArray(parsed.urlset.url)
                ? parsed.urlset.url
                : [parsed.urlset.url];
            for (const entry of urlEntries) {
                if (entry && entry.loc) {
                    urls.push(entry.loc);
                }
            }
        }
        if (!isChildSitemap) {
            console.log(`✓ Found ${urls.length} URLs in sitemap`);
        }
        if (urls.length > 50000) {
            console.warn(`⚠️  Sitemap contains ${urls.length} URLs (max recommended: 50,000)`);
        }
        return urls;
    }
    catch (error) {
        console.warn(`Failed to fetch sitemap from ${sitemapUrl}: ${error.message}`);
        return [];
    }
}
/**
 * Auto-detects sitemap URL(s) from robots.txt or common locations
 */
export async function autoDetectSitemap(baseUrl, robotsSitemaps, userAgent) {
    const url = new URL(baseUrl);
    const baseHostUrl = `${url.protocol}//${url.host}`;
    const candidateUrls = [];
    // First priority: sitemaps from robots.txt
    if (robotsSitemaps.length > 0) {
        candidateUrls.push(...robotsSitemaps);
    }
    // Common sitemap locations
    const commonLocations = [
        '/sitemap.xml',
        '/sitemap_index.xml',
        '/sitemap1.xml',
        '/sitemap-index.xml',
    ];
    for (const location of commonLocations) {
        const fullUrl = `${baseHostUrl}${location}`;
        if (!candidateUrls.includes(fullUrl)) {
            candidateUrls.push(fullUrl);
        }
    }
    // Try to fetch each candidate
    const foundSitemaps = [];
    for (const candidateUrl of candidateUrls) {
        try {
            const response = await axios.head(candidateUrl, {
                timeout: 5000,
                headers: { 'User-Agent': userAgent },
                validateStatus: (status) => status === 200,
            });
            if (response.status === 200) {
                foundSitemaps.push(candidateUrl);
                console.log(`✓ Found sitemap at ${candidateUrl}`);
            }
        }
        catch {
            // Sitemap doesn't exist at this location
        }
    }
    return foundSitemaps;
}
/**
 * Analyzes sitemap against crawled pages
 */
export async function analyzeSitemap(pages, baseUrl, robotsSitemaps, userAgent, customSitemapUrl) {
    // Create normalized URL maps for comparison
    const crawledUrlsMap = new Map(); // normalized -> original
    for (const page of pages) {
        const normalized = normalizeUrlForComparison(page.url);
        crawledUrlsMap.set(normalized, page.url);
    }
    let allSitemapUrls = [];
    const sitemapUrlsMap = new Map(); // normalized -> original
    const sitemapUrlsSet = new Set(); // original URLs for compatibility
    // Determine which sitemaps to analyze
    let sitemapUrls = [];
    if (customSitemapUrl) {
        sitemapUrls = [customSitemapUrl];
    }
    else {
        sitemapUrls = await autoDetectSitemap(baseUrl, robotsSitemaps, userAgent);
    }
    // Fetch all sitemaps
    for (const sitemapUrl of sitemapUrls) {
        const urls = await fetchSitemap(sitemapUrl, userAgent);
        allSitemapUrls.push(...urls);
        for (const url of urls) {
            sitemapUrlsSet.add(url);
            const normalized = normalizeUrlForComparison(url);
            sitemapUrlsMap.set(normalized, url);
        }
    }
    // Analyze differences using normalized URLs
    const urlsNotInSitemap = [];
    const orphanUrls = []; // In sitemap but not crawled
    const nonIndexableInSitemap = [];
    // Find crawled URLs not in sitemap (using normalized comparison)
    for (const page of pages) {
        const normalizedUrl = normalizeUrlForComparison(page.url);
        if (!sitemapUrlsMap.has(normalizedUrl) && page.status === 200) {
            urlsNotInSitemap.push(page.url);
        }
    }
    // Find sitemap URLs not crawled (using normalized comparison)
    for (const [normalizedUrl, originalUrl] of sitemapUrlsMap.entries()) {
        if (!crawledUrlsMap.has(normalizedUrl)) {
            orphanUrls.push(originalUrl);
        }
    }
    // Find non-indexable URLs in sitemap
    for (const page of pages) {
        const normalizedUrl = normalizeUrlForComparison(page.url);
        if (sitemapUrlsMap.has(normalizedUrl)) {
            // Check if page is non-indexable
            const isNonIndexable = page.status !== 200 ||
                page.robotsDirectives?.includes('noindex') ||
                false;
            if (isNonIndexable) {
                nonIndexableInSitemap.push(page.url);
            }
        }
    }
    return {
        sitemapUrls,
        urlsInSitemap: sitemapUrlsSet,
        urlsNotInSitemap,
        orphanUrls,
        nonIndexableInSitemap,
        sitemapSize: Buffer.byteLength(allSitemapUrls.join('\n')),
        sitemapUrlCount: allSitemapUrls.length,
    };
}
/**
 * Validates sitemap quality
 */
export function validateSitemapQuality(sitemapInfo) {
    const issues = [];
    if (sitemapInfo.sitemapUrlCount > 50000) {
        issues.push(`Sitemap contains ${sitemapInfo.sitemapUrlCount} URLs (max: 50,000)`);
    }
    if (sitemapInfo.sitemapSize > 50 * 1024 * 1024) {
        issues.push(`Sitemap is ${(sitemapInfo.sitemapSize / 1024 / 1024).toFixed(2)}MB (max: 50MB)`);
    }
    if (sitemapInfo.urlsNotInSitemap.length > 0) {
        issues.push(`${sitemapInfo.urlsNotInSitemap.length} crawled URLs not in sitemap`);
    }
    if (sitemapInfo.orphanUrls.length > 0) {
        issues.push(`${sitemapInfo.orphanUrls.length} URLs in sitemap but not crawled (orphans)`);
    }
    if (sitemapInfo.nonIndexableInSitemap.length > 0) {
        issues.push(`${sitemapInfo.nonIndexableInSitemap.length} non-indexable URLs in sitemap`);
    }
    return issues;
}
//# sourceMappingURL=sitemapAnalyzer.js.map