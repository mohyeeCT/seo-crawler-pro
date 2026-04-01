/**
 * Robots.txt parser and validator
 */
export interface RobotsTxtInfo {
    exists: boolean;
    content: string;
    crawlDelay?: number;
    sitemaps: string[];
    blockedUrls: string[];
}
/**
 * Fetches and parses robots.txt for a domain
 */
export declare function fetchRobotsTxt(baseUrl: string, userAgent: string): Promise<{
    parser: any;
    info: RobotsTxtInfo;
} | null>;
/**
 * Checks if a URL is allowed by robots.txt
 */
export declare function isAllowedByRobots(parser: any, url: string): boolean;
/**
 * Gets the crawl delay from robots.txt
 */
export declare function getCrawlDelay(info: RobotsTxtInfo | null, maxDelay?: number): number;
//# sourceMappingURL=robotsParser.d.ts.map