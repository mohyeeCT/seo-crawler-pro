/**
 * Crawl mode for the website crawler
 */
export type CrawlMode = 'crawl' | 'sitemap' | 'both';
/**
 * Configuration for the website crawler
 */
export interface CrawlConfig {
    url: string;
    depth: number;
    maxPages: number;
    concurrency: number;
    output: string;
    userAgent: string;
    timeout: number;
    checkExternalLinks?: boolean;
    analyzeSitemaps?: boolean;
    respectRobotsTxt?: boolean;
    crawlMode?: CrawlMode;
    sitemapUrl?: string;
    debugLog?: boolean;
    logFile?: string;
    stealth?: {
        enabled: boolean;
        rotateUserAgents?: boolean;
        randomizeHeaders?: boolean;
        randomizeTimings?: boolean;
        minDelay?: number;
        maxDelay?: number;
        proxyList?: string[];
        customUserAgents?: string[];
    };
}
/**
 * Raw data from a crawled page
 */
export interface PageData {
    url: string;
    html: string;
    status: number;
    depth: number;
    timestamp: number;
    responseTime: number;
    redirectChain: RedirectInfo[];
    headers?: Record<string, string>;
}
/**
 * Structured data found on a page
 */
export interface StructuredData {
    jsonLd: any[];
    microdata: any[];
}
/**
 * hreflang link information
 */
export interface HreflangLink {
    lang: string;
    href: string;
}
/**
 * Link information from a page
 */
export interface LinkData {
    href: string;
    text: string;
    rel: string;
    isInternal: boolean;
    isNofollow: boolean;
    status?: number;
    finalUrl?: string;
    redirectsExternally?: boolean;
}
/**
 * Heading information
 */
export interface HeadingData {
    level: number;
    text: string;
}
/**
 * Image information
 */
export interface ImageData {
    src: string;
    alt: string;
    hasAlt: boolean;
    fileSize?: number;
    width?: string;
    height?: string;
    hasWidth: boolean;
    hasHeight: boolean;
    altTooLong: boolean;
}
/**
 * Content metrics for a page
 */
export interface ContentMetrics {
    wordCount: number;
    textLength: number;
    htmlSize: number;
}
/**
 * Performance metrics for a page
 */
export interface PerformanceMetrics {
    responseTime: number;
    redirectChain: RedirectInfo[];
    externalResourceCount: number;
    renderBlockingResources: string[];
    largeInlineScripts: number;
    largeInlineStyles: number;
}
/**
 * Redirect information
 */
export interface RedirectInfo {
    from: string;
    to: string;
    status: number;
}
/**
 * Issue severity levels (like Screaming Frog)
 */
export type IssueSeverity = 'high' | 'medium' | 'low';
/**
 * Issue with severity classification
 */
export interface Issue {
    message: string;
    severity: IssueSeverity;
}
/**
 * Scoring categories for the SEO scoring engine
 */
export type ScoreCategory = 'technical' | 'content' | 'onPage' | 'links' | 'security' | 'performance';
/**
 * Individual penalty applied during scoring
 */
export interface ScorePenalty {
    category: ScoreCategory;
    issue: string;
    severity: IssueSeverity;
    points: number;
    recommendation?: string;
}
/**
 * Category level score information
 */
export interface CategoryScore {
    score: number;
    maxPossiblePenalties: number;
    appliedPenalties: number;
    penalties: ScorePenalty[];
}
/**
 * Calculated score for an individual page
 */
export interface PageScore {
    url: string;
    overallScore: number;
    categoryScores: Record<ScoreCategory, CategoryScore>;
    totalPenalties: number;
    grade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    recommendations: string[];
}
/**
 * Score distribution for a site (aligned with Lighthouse ranges)
 */
export interface ScoreDistribution {
    excellent: number;
    good: number;
    fair: number;
    needsImprovement: number;
    poor: number;
    critical: number;
}
/**
 * Calculated importance information for a page
 */
export interface PageImportance {
    inlinkCount: number;
    depth: number;
    importanceScore: number;
    isHighPriority: boolean;
}
/**
 * Site segment scores for deeper analysis
 */
export interface SiteSegment {
    name: string;
    pattern: string;
    pages: number;
    averageScore: number;
    distribution: ScoreDistribution;
}
/**
 * Site-level penalty detail for transparency
 */
export interface SiteLevelPenaltyDetail {
    type: 'critical' | 'high' | 'medium' | 'low' | 'architectural';
    issue: string;
    affectedPercentage: number;
    penaltyPercentage: number;
    description: string;
}
/**
 * Aggregate site-wide scoring information
 */
export interface SiteScore {
    overallScore: number;
    averagePageScore: number;
    medianPageScore: number;
    topPagesScore: number;
    technicalHealthScore: number;
    siteLevelPenalties: number;
    baseScoreBeforePenalties?: number;
    totalPenaltyPercentage?: number;
    penaltyDetails?: SiteLevelPenaltyDetail[];
    distribution: ScoreDistribution;
    categoryAverages: Record<ScoreCategory, number>;
    totalPages: number;
    indexablePages: number;
    percentageWithoutErrors: number;
    uniqueIssueTypes: number;
    topIssues: Array<{
        issue: string;
        affectedPages: number;
        percentageAffected: number;
        averageImpact: number;
        category: ScoreCategory;
    }>;
    segments?: SiteSegment[];
    bestPages: PageScore[];
    worstPages: PageScore[];
}
/**
 * Configurable scoring weights for categories
 */
export interface ScoringWeights {
    technical: number;
    content: number;
    onPage: number;
    links: number;
    security: number;
    performance: number;
}
/**
 * External script information
 */
export interface ExternalScript {
    src: string;
    async?: boolean;
    defer?: boolean;
    type?: string;
    isExternal?: boolean;
}
/**
 * Security metrics for a page
 */
export interface SecurityMetrics {
    isHttps: boolean;
    hasHsts: boolean;
    hasCsp: boolean;
    hasXContentTypeOptions: boolean;
    hasXFrameOptions: boolean;
    hasReferrerPolicy: boolean;
    mixedContentIssues: MixedContentIssue[];
    insecureFormActions: string[];
    protocolRelativeUrls: string[];
    securityHeaders: Record<string, string>;
}
/**
 * Mixed content issue (HTTP resource on HTTPS page)
 */
export interface MixedContentIssue {
    resourceUrl: string;
    resourceType: 'image' | 'script' | 'stylesheet' | 'iframe' | 'other';
}
/**
 * URL quality metrics
 */
export interface UrlQualityMetrics {
    hasMultipleSlashes: boolean;
    hasSpaces: boolean;
    hasNonAscii: boolean;
    hasUppercase: boolean;
    hasRepetitivePaths: boolean;
    urlLength: number;
    hasQueryParams: boolean;
    hasTrackingParams: boolean;
    hasFragmentOnly: boolean;
    queryParams: Record<string, string>;
    issues: string[];
}
/**
 * Content quality metrics
 */
export interface ContentQualityMetrics {
    contentHash: string;
    bodyText: string;
    hasLoremIpsum: boolean;
    readabilityScore: ReadabilityMetrics;
    contentToCodeRatio: number;
    spellingErrors: string[];
    isSoft404: boolean;
}
/**
 * Readability metrics
 */
export interface ReadabilityMetrics {
    fleschReadingEase: number;
    fleschKincaidGrade: number;
    automatedReadabilityIndex: number;
    averageWordsPerSentence: number;
    averageSyllablesPerWord: number;
}
/**
 * HTML validation metrics
 */
export interface HtmlValidationMetrics {
    hasHead: boolean;
    hasBody: boolean;
    multipleHeads: number;
    multipleBodies: number;
    elementsOutsideHead: string[];
    documentOrderIssues: string[];
    htmlSize: number;
    domDepth: number;
    hasDoctype: boolean;
    doctypeValue?: string;
    deprecatedElements: string[];
}
/**
 * Pagination information
 */
export interface PaginationInfo {
    hasPagination: boolean;
    nextUrl?: string;
    prevUrl?: string;
    isInSequence: boolean;
    sequenceErrors: string[];
}
/**
 * Enhanced hreflang validation
 */
export interface HreflangValidation {
    hasSelfReference: boolean;
    hasReturnLinks: boolean;
    invalidLanguageCodes: string[];
    invalidRegionCodes: string[];
    duplicateLanguageCodes: string[];
    missingReturnLinks: string[];
}
/**
 * Sitemap information
 */
export interface SitemapInfo {
    sitemapUrls: string[];
    urlsInSitemap: Set<string>;
    urlsNotInSitemap: string[];
    orphanUrls: string[];
    nonIndexableInSitemap: string[];
    sitemapSize: number;
    sitemapUrlCount: number;
}
/**
 * Link quality metrics
 */
export interface LinkQualityMetrics {
    hasOutlinks: boolean;
    internalOutlinkCount: number;
    externalOutlinkCount: number;
    hasLocalhostLinks: boolean;
    localhostLinks: string[];
    weakAnchorTexts: LinkData[];
    inlinkCount: number;
    isOrphan: boolean;
}
/**
 * Enhanced canonical information
 */
export interface CanonicalInfo {
    canonicalUrl?: string;
    isRelative: boolean;
    hasFragment: boolean;
    hasInvalidAttributes: boolean;
    isOutsideHead: boolean;
    pointsToNonIndexable: boolean;
}
/**
 * Schema validation result
 */
export interface SchemaValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    types: string[];
}
/**
 * Indexability information
 */
export interface IndexabilityInfo {
    isIndexable: boolean;
    reasons: string[];
}
/**
 * Extracted metadata from a page
 */
export interface PageMetadata {
    url: string;
    status: number;
    depth: number;
    headers?: Record<string, string>;
    title?: string;
    titleLength?: number;
    titlePixelWidth?: number;
    metaDescription?: string;
    metaDescriptionLength?: number;
    metaDescriptionPixelWidth?: number;
    canonicalUrl?: string;
    canonicalUrls?: string[];
    canonicalInfo?: CanonicalInfo;
    metaRobots?: string;
    robotsDirectives?: string[];
    openGraph: Record<string, string>;
    twitterCards: Record<string, string>;
    hreflangs: HreflangLink[];
    hreflangValidation?: HreflangValidation;
    structuredData: StructuredData;
    schemaValidation?: SchemaValidationResult;
    issues: Issue[];
    links: LinkData[];
    headings: HeadingData[];
    images: ImageData[];
    contentMetrics: ContentMetrics;
    performance: PerformanceMetrics;
    externalScripts: ExternalScript[];
    security?: SecurityMetrics;
    urlQuality?: UrlQualityMetrics;
    contentQuality?: ContentQualityMetrics;
    htmlValidation?: HtmlValidationMetrics;
    pagination?: PaginationInfo;
    linkQuality?: LinkQualityMetrics;
    indexability?: IndexabilityInfo;
}
/**
 * Group of pages with duplicate content
 */
export interface DuplicateGroup {
    value: string;
    pages: string[];
}
/**
 * Summary counts of issues found
 */
export interface IssuesSummary {
    missingTitles: number;
    missingDescriptions: number;
    longTitles: number;
    shortTitles: number;
    longDescriptions: number;
    shortDescriptions: number;
    duplicateTitles: number;
    duplicateDescriptions: number;
    multipleCanonicals: number;
    conflictingRobots: number;
    malformedJsonLd: number;
    missingH1: number;
    multipleH1: number;
    duplicateH1: number;
    duplicateH2: number;
    improperHeadingHierarchy: number;
    brokenLinks: number;
    imagesWithoutAlt: number;
    thinContent: number;
    slowPages: number;
    redirectChains: number;
    exactDuplicates: number;
    nearDuplicates: number;
    soft404s: number;
    loremIpsum: number;
    poorReadability: number;
    spellingErrors: number;
    httpPages: number;
    mixedContent: number;
    insecureForms: number;
    missingSecurityHeaders: number;
    urlQualityIssues: number;
    nonAsciiUrls: number;
    uppercaseUrls: number;
    longUrls: number;
    pagesWithoutOutlinks: number;
    highOutlinkCount: number;
    localhostLinks: number;
    orphanPages: number;
    weakAnchorText: number;
    htmlStructureIssues: number;
    largeHtml: number;
    paginationIssues: number;
    hreflangIssues: number;
    schemaErrors: number;
    notInSitemap: number;
    orphanInSitemap: number;
    nonIndexableInSitemap: number;
}
/**
 * Site structure node for hierarchical visualization
 */
export interface SiteStructureNode {
    path: string;
    fullUrl: string;
    depth: number;
    children: SiteStructureNode[];
    pageData?: PageMetadata;
}
/**
 * External script usage across site
 */
export interface ScriptUsage {
    src: string;
    pages: string[];
    count: number;
    async: boolean;
    defer: boolean;
    type?: string;
}
/**
 * Complete analysis result from all pages
 */
export interface AnalysisResult {
    pages: PageMetadata[];
    pageScores: PageScore[];
    siteScore: SiteScore;
    appliedScoringWeights: ScoringWeights;
    duplicateTitles: DuplicateGroup[];
    duplicateDescriptions: DuplicateGroup[];
    missingTitles: PageMetadata[];
    missingDescriptions: PageMetadata[];
    longTitles: PageMetadata[];
    shortTitles: PageMetadata[];
    longDescriptions: PageMetadata[];
    shortDescriptions: PageMetadata[];
    missingH1: PageMetadata[];
    multipleH1: PageMetadata[];
    duplicateH1: DuplicateGroup[];
    duplicateH2: DuplicateGroup[];
    improperHeadingHierarchy: PageMetadata[];
    brokenLinks: PageMetadata[];
    imagesWithoutAlt: PageMetadata[];
    thinContent: PageMetadata[];
    slowPages: PageMetadata[];
    pagesWithRedirects: PageMetadata[];
    exactDuplicateContent: DuplicateGroup[];
    nearDuplicateContent: DuplicateGroup[];
    soft404Pages: PageMetadata[];
    loremIpsumPages: PageMetadata[];
    poorReadabilityPages: PageMetadata[];
    spellingErrorPages: PageMetadata[];
    httpPages: PageMetadata[];
    mixedContentPages: PageMetadata[];
    insecureFormPages: PageMetadata[];
    missingSecurityHeaderPages: PageMetadata[];
    urlQualityIssues: PageMetadata[];
    pagesWithoutOutlinks: PageMetadata[];
    highOutlinkPages: PageMetadata[];
    localhostLinkPages: PageMetadata[];
    orphanPages: PageMetadata[];
    weakAnchorTextPages: PageMetadata[];
    htmlStructureIssues: PageMetadata[];
    largeHtmlPages: PageMetadata[];
    paginationIssues: PageMetadata[];
    hreflangIssues: PageMetadata[];
    schemaErrorPages: PageMetadata[];
    totalPages: number;
    issuesSummary: IssuesSummary;
    allLinks: Array<LinkData & {
        pageUrl: string;
    }>;
    allImages: Array<ImageData & {
        pageUrl: string;
    }>;
    allHeadings: Array<HeadingData & {
        pageUrl: string;
    }>;
    siteStructure: SiteStructureNode[];
    externalScripts: ScriptUsage[];
    pages404: Array<PageMetadata & {
        referrers: string[];
    }>;
    sitemapInfo?: SitemapInfo;
}
//# sourceMappingURL=types.d.ts.map