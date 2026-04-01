import type { PageMetadata, AnalysisResult, ScoringWeights } from './types.js';
export interface AnalyzeOptions {
    scoringWeights?: Partial<ScoringWeights>;
}
/**
 * Analyzes all pages for SEO issues
 * Performs per-page checks and site-wide duplicate detection
 */
export declare function analyzePages(pages: PageMetadata[], onProgress?: (step: string, current?: number, total?: number) => void, options?: AnalyzeOptions): AnalysisResult;
//# sourceMappingURL=analyzer.d.ts.map