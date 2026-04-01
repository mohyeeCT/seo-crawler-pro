import type { PageMetadata, RedirectInfo } from './types.js';
/**
 * Parses HTML content and extracts SEO metadata
 */
export declare function parseMetadata(html: string, url: string, status: number, depth: number, responseTime?: number, redirectChain?: RedirectInfo[], headers?: Record<string, string>, userAgent?: string, validateLinks?: boolean): Promise<PageMetadata>;
//# sourceMappingURL=parser.d.ts.map