/**
 * Advanced content extraction using Readability-inspired scoring algorithm
 * Reliably extracts main content from any page structure
 */
import type { DollarFunction } from './domLite.js';
/**
 * Extraction result with diagnostics
 */
export interface ExtractionResult {
    text: string;
    score: number;
    element: string;
    method: 'scoring' | 'semantic' | 'fallback';
    stats: {
        textLength: number;
        tagCount: number;
        linkDensity: number;
        paragraphCount: number;
    };
}
/**
 * Advanced content extractor using scoring algorithm
 */
export declare class ContentExtractor {
    private $;
    constructor($: DollarFunction);
    /**
     * Extract main content from the page
     */
    extract(): ExtractionResult;
    /**
     * Try to extract from semantic HTML5 elements
     */
    private trySemanticExtraction;
    /**
     * Score-based content extraction (main algorithm)
     */
    private tryScoringExtraction;
    /**
     * Fallback extraction with minimal filtering
     */
    private fallbackExtraction;
    /**
     * Find candidate elements for content extraction
     */
    private findCandidates;
    /**
     * Score an element based on multiple factors
     */
    private scoreElement;
    /**
     * Score based on class names and IDs
     */
    private scoreClassAndId;
    /**
     * Score based on text density (text length / tag count ratio)
     */
    private scoreTextDensity;
    /**
     * Score based on link density (higher link density = likely navigation)
     */
    private scoreLinkDensity;
    /**
     * Score based on paragraph count
     */
    private scoreParagraphDensity;
    /**
     * Score based on tag name
     */
    private scoreTagName;
    /**
     * Refine content by removing low-scoring children
     */
    private refineContent;
    /**
     * Clean element by removing non-content tags
     */
    private cleanElement;
    /**
     * Extract text from element with normalization
     */
    private extractText;
    /**
     * Calculate statistics for diagnostics
     */
    private calculateStats;
    /**
     * Get readable element path for debugging
     */
    private getElementPath;
}
//# sourceMappingURL=contentExtractor.d.ts.map