import type { CrawlConfig, PageData } from './types.js';
type ProgressCallback = (current: number, total: number, url: string, status: number) => void;
/**
 * Crawls a website starting from the given URL
 * Uses breadth-first search with configurable concurrency
 */
export declare function crawlSite(config: CrawlConfig, onProgress?: ProgressCallback): Promise<PageData[]>;
export {};
//# sourceMappingURL=crawler.d.ts.map