import type { PageMetadata, PageScore, ScoringWeights, SiteScore, PageImportance, SitemapInfo } from './types.js';
declare const DEFAULT_WEIGHTS: ScoringWeights;
export declare function calculatePageImportance(page: PageMetadata): PageImportance;
export declare function calculatePageScore(page: PageMetadata, weights?: ScoringWeights): PageScore;
export declare function calculateSiteScore(pages: PageMetadata[], pageScores: PageScore[], sitemapInfo?: SitemapInfo): SiteScore;
export declare function generateScoreHistogram(pageScores: PageScore[], bucketSize?: number): Array<{
    range: string;
    count: number;
}>;
export { DEFAULT_WEIGHTS };
//# sourceMappingURL=scorer.d.ts.map