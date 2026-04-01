/**
 * Robots.txt parser and validator
 */
import axios from 'axios';
import robotsParser from 'robots-parser';
/**
 * Fetches and parses robots.txt for a domain
 */
export async function fetchRobotsTxt(baseUrl, userAgent) {
    try {
        const url = new URL(baseUrl);
        const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
        console.log(`Fetching robots.txt from ${robotsUrl}...`);
        const response = await axios.get(robotsUrl, {
            timeout: 10000,
            headers: { 'User-Agent': userAgent },
            validateStatus: (status) => status === 200 || status === 404,
        });
        if (response.status === 404) {
            console.log('No robots.txt found (404)');
            return {
                parser: robotsParser(robotsUrl, ''),
                info: {
                    exists: false,
                    content: '',
                    sitemaps: [],
                    blockedUrls: [],
                },
            };
        }
        const content = response.data;
        const parser = robotsParser(robotsUrl, content);
        // Extract sitemaps
        const sitemaps = [];
        const sitemapMatches = content.matchAll(/^Sitemap:\s*(.+)$/gim);
        for (const match of sitemapMatches) {
            sitemaps.push(match[1].trim());
        }
        // Extract crawl delay
        let crawlDelay;
        const crawlDelayMatch = content.match(/^Crawl-delay:\s*(\d+)$/im);
        if (crawlDelayMatch) {
            crawlDelay = parseInt(crawlDelayMatch[1]);
        }
        console.log(`✓ robots.txt parsed (${sitemaps.length} sitemaps found, crawl-delay: ${crawlDelay || 'none'})`);
        return {
            parser,
            info: {
                exists: true,
                content,
                crawlDelay,
                sitemaps,
                blockedUrls: [],
            },
        };
    }
    catch (error) {
        console.warn(`Failed to fetch robots.txt: ${error.message}`);
        return null;
    }
}
/**
 * Checks if a URL is allowed by robots.txt
 */
export function isAllowedByRobots(parser, url) {
    if (!parser)
        return true;
    try {
        return parser.isAllowed(url);
    }
    catch (error) {
        // If parsing fails, allow the URL
        return true;
    }
}
/**
 * Gets the crawl delay from robots.txt
 */
export function getCrawlDelay(info, maxDelay = 5000) {
    if (!info || !info.crawlDelay)
        return 0;
    // Cap at maxDelay to prevent unreasonably slow crawls
    return Math.min(info.crawlDelay * 1000, maxDelay);
}
//# sourceMappingURL=robotsParser.js.map