/**
 * Parallel HTML parser using worker threads
 */
import type { PageData, PageMetadata } from './types.js';
/**
 * Parse pages in parallel using worker threads
 * Distributes work across CPU cores for 4-8x speedup
 */
export declare function parseMetadataParallel(pageData: PageData[], onProgress?: (completed: number, total: number) => void): Promise<PageMetadata[]>;
//# sourceMappingURL=parallelParser.d.ts.map