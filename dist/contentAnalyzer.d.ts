/**
 * Advanced content analysis including duplicate detection and similarity analysis
 */
import type { PageMetadata, DuplicateGroup } from './types.js';
/**
 * Finds exact duplicate content across pages
 */
export declare function findExactDuplicates(pages: PageMetadata[]): DuplicateGroup[];
/**
 * Finds near-duplicate content across pages (>95% similar)
 * Uses Rust native module with LSH for O(n) performance when available,
 * falls back to TypeScript O(n²) implementation otherwise
 */
export declare function findNearDuplicates(pages: PageMetadata[], threshold?: number): DuplicateGroup[];
/**
 * Returns whether native Rust module is being used
 */
export declare function isUsingNativeModule(): boolean;
/**
 * Finds duplicate H1 tags across pages
 */
export declare function findDuplicateH1s(pages: PageMetadata[]): DuplicateGroup[];
/**
 * Finds duplicate H2 tags across pages
 */
export declare function findDuplicateH2s(pages: PageMetadata[]): DuplicateGroup[];
/**
 * Analyzes all pages for content quality issues
 */
export declare function analyzeContentQuality(pages: PageMetadata[]): void;
//# sourceMappingURL=contentAnalyzer.d.ts.map