/**
 * Utilities for text metrics calculation including pixel width and readability
 */
/**
 * Estimates the pixel width of text (used for title/description truncation)
 * Based on average character widths in common Google fonts
 * Optimized with character code ranges for faster lookup
 */
export declare function estimatePixelWidth(text: string): number;
/**
 * Counts syllables in a word (for readability calculations)
 * Optimized with pre-compiled regex and fast character checks
 */
export declare function countSyllables(word: string): number;
/**
 * Counts sentences in text
 * Optimized version with pre-compiled regex
 */
export declare function countSentences(text: string): number;
/**
 * Calculates readability metrics for text
 */
export interface ReadabilityMetrics {
    fleschReadingEase: number;
    fleschKincaidGrade: number;
    automatedReadabilityIndex: number;
    averageWordsPerSentence: number;
    averageSyllablesPerWord: number;
}
export declare function calculateReadability(text: string): ReadabilityMetrics;
/**
 * Determines if readability is poor (requires > 12th grade reading level)
 */
export declare function isPoorReadability(metrics: ReadabilityMetrics): boolean;
//# sourceMappingURL=textMetrics.d.ts.map