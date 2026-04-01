import type { AnalysisResult } from './types.js';
/**
 * Generates HTML reports from analysis results
 */
export declare function generateReports(analysis: AnalysisResult, outputDir: string, options?: {
    generatePageHtml?: boolean;
}): Promise<void>;
//# sourceMappingURL=reporter.d.ts.map