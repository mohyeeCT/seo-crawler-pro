/**
 * Utilities for content analysis including hashing and similarity detection
 */
/**
 * Cleans text for comparison (removes whitespace, punctuation, lowercase)
 */
export declare function cleanTextForComparison(text: string): string;
/**
 * Generates SHA-256 hash of content for exact duplicate detection
 * Designed to distinguish between pages with similar structure but different content
 */
export declare function generateContentHash(content: string): string;
/**
 * Generates n-grams from text (for shingling)
 */
export declare function generateNGrams(text: string, n?: number): Set<string>;
/**
 * Creates a MinHash signature for similarity detection
 */
export declare function createMinHashSignature(ngrams: Set<string>, numHashes?: number): number[];
/**
 * Calculates Jaccard similarity between two MinHash signatures
 */
export declare function calculateJaccardSimilarity(sig1: number[], sig2: number[]): number;
/**
 * Calculates content similarity between two texts (0-1 scale)
 * Enhanced for e-commerce content discrimination
 */
export declare function calculateContentSimilarity(text1: string, text2: string): number;
/**
 * Checks if content is an exact duplicate
 */
export declare function isExactDuplicate(hash1: string, hash2: string): boolean;
/**
 * Checks if content is a near duplicate (>90% similar)
 */
export declare function isNearDuplicate(similarity: number, threshold?: number): boolean;
/**
 * Detects lorem ipsum placeholder text
 */
export declare function hasLoremIpsum(text: string): boolean;
/**
 * Detects potential soft 404 (page returns 200 but shows "not found" content)
 */
export declare function isSoft404Content(text: string, wordCount: number): boolean;
/**
 * Calculates content-to-code ratio
 */
export declare function calculateContentToCodeRatio(textLength: number, htmlSize: number): number;
/**
 * Groups pages by content hash for duplicate detection
 */
export interface DuplicateGroup {
    hash: string;
    urls: string[];
}
export declare function findDuplicatesByHash(pages: Array<{
    url: string;
    hash: string;
}>): DuplicateGroup[];
//# sourceMappingURL=contentUtils.d.ts.map