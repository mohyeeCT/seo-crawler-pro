/**
 * Advanced link analysis including orphan detection, anchor text quality, and link metrics
 */
import type { PageMetadata, LinkQualityMetrics } from './types.js';
/**
 * Analyzes link quality for a single page
 */
export declare function analyzeLinkQuality(page: PageMetadata, inlinkMap: Map<string, number>): LinkQualityMetrics;
/**
 * Builds a map of inlinks (how many internal links point to each URL)
 */
export declare function buildInlinkMap(pages: PageMetadata[]): Map<string, number>;
/**
 * Analyzes link quality for all pages
 */
export declare function analyzeLinkQualityForAllPages(pages: PageMetadata[]): void;
//# sourceMappingURL=linkAnalyzer.d.ts.map