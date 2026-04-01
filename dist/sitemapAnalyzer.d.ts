import type { PageMetadata, SitemapInfo } from './types.js';
/**
 * Fetches and parses XML sitemap
 */
export declare function fetchSitemap(sitemapUrl: string, userAgent: string, isChildSitemap?: boolean): Promise<string[]>;
/**
 * Auto-detects sitemap URL(s) from robots.txt or common locations
 */
export declare function autoDetectSitemap(baseUrl: string, robotsSitemaps: string[], userAgent: string): Promise<string[]>;
/**
 * Analyzes sitemap against crawled pages
 */
export declare function analyzeSitemap(pages: PageMetadata[], baseUrl: string, robotsSitemaps: string[], userAgent: string, customSitemapUrl?: string): Promise<SitemapInfo>;
/**
 * Validates sitemap quality
 */
export declare function validateSitemapQuality(sitemapInfo: SitemapInfo): string[];
//# sourceMappingURL=sitemapAnalyzer.d.ts.map