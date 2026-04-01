import fs from 'fs/promises';
import path from 'path';
import { generateScoreHistogram } from './scorer.js';
function severityRank(sev) {
    switch (sev) {
        case 'high': return 0;
        case 'medium': return 1;
        case 'low': return 2;
        default: return 3;
    }
}
async function writeJSON(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
/**
 * Generates JSON data files for API-like access to SEO report data
 */
export async function generateJsonRoutes(analysis, outputDir) {
    console.log(`\nGenerating JSON routes in ${outputDir}...`);
    // Create JSON directory structure
    const jsonDir = path.join(outputDir, 'json');
    const issuesDir = path.join(jsonDir, 'issues');
    const pagesDir = path.join(jsonDir, 'pages');
    await fs.mkdir(issuesDir, { recursive: true });
    await fs.mkdir(pagesDir, { recursive: true });
    // Generate JSON files for each page
    await generatePageJsonFiles(analysis, issuesDir, pagesDir);
    // Generate aggregate JSON files
    await generateAggregateJsonFiles(analysis, jsonDir);
    console.log(`✓ JSON routes: ${analysis.pages.length} page files + aggregate data`);
}
/**
 * Generates individual JSON files for each page
 */
async function generatePageJsonFiles(analysis, issuesDir, pagesDir) {
    const scoreMap = new Map();
    for (const score of analysis.pageScores) {
        scoreMap.set(score.url, score);
    }
    for (const page of analysis.pages) {
        // Create a URL-safe filename from the page URL
        const filename = createUrlSafeFilename(page.url);
        // Generate issues JSON file
        const sortedIssues = [...page.issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
        const pageScore = scoreMap.get(page.url);
        const issuesData = {
            url: page.url,
            status: page.status,
            issues: sortedIssues,
            issuesCount: page.issues.length,
            highSeverityCount: page.issues.filter(i => i.severity === 'high').length,
            mediumSeverityCount: page.issues.filter(i => i.severity === 'medium').length,
            lowSeverityCount: page.issues.filter(i => i.severity === 'low').length,
            score: pageScore ? pageScore.overallScore : null,
            grade: pageScore ? pageScore.grade : null,
        };
        await writeJSON(path.join(issuesDir, `${filename}.json`), issuesData);
        // Generate full page metadata JSON file
        const pageData = {
            url: page.url,
            status: page.status,
            depth: page.depth,
            title: page.title,
            titleLength: page.titleLength,
            titlePixelWidth: page.titlePixelWidth,
            metaDescription: page.metaDescription,
            metaDescriptionLength: page.metaDescriptionLength,
            metaDescriptionPixelWidth: page.metaDescriptionPixelWidth,
            canonicalUrl: page.canonicalUrl,
            robotsDirectives: page.robotsDirectives,
            openGraph: page.openGraph,
            twitterCards: page.twitterCards,
            hreflangs: page.hreflangs,
            structuredData: page.structuredData,
            links: page.links,
            headings: page.headings,
            images: page.images,
            contentMetrics: page.contentMetrics,
            performance: page.performance,
            externalScripts: page.externalScripts,
            security: page.security,
            urlQuality: page.urlQuality,
            contentQuality: page.contentQuality,
            htmlValidation: page.htmlValidation,
            pagination: page.pagination,
            linkQuality: page.linkQuality,
            indexability: page.indexability,
            issues: sortedIssues,
            score: pageScore ?? null,
        };
        await writeJSON(path.join(pagesDir, `${filename}.json`), pageData);
    }
}
/**
 * Generates aggregate JSON files for the entire site
 */
async function generateAggregateJsonFiles(analysis, jsonDir) {
    const scoreMap = new Map();
    for (const score of analysis.pageScores) {
        scoreMap.set(score.url, score);
    }
    // All pages summary
    const pagesSummary = analysis.pages.map(p => ({
        url: p.url,
        status: p.status,
        title: p.title,
        titleLength: p.titleLength,
        metaDescriptionLength: p.metaDescriptionLength,
        h1Count: p.headings.filter(h => h.level === 1).length,
        wordCount: p.contentMetrics?.wordCount ?? 0,
        htmlSize: p.contentMetrics?.htmlSize ?? 0,
        linksCount: p.links.length,
        imagesCount: p.images.length,
        issuesCount: p.issues.length,
        responseTime: p.performance?.responseTime ?? 0,
        redirectCount: p.performance?.redirectChain?.length ?? 0,
        score: scoreMap.get(p.url)?.overallScore ?? null,
        grade: scoreMap.get(p.url)?.grade ?? null,
    }));
    await writeJSON(path.join(jsonDir, 'all-pages.json'), { pages: pagesSummary, total: pagesSummary.length });
    // All issues
    const allIssues = analysis.pages.flatMap(p => p.issues.map(issue => ({
        url: p.url,
        message: issue.message,
        severity: issue.severity,
    }))).sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
    await writeJSON(path.join(jsonDir, 'all-issues.json'), { issues: allIssues, total: allIssues.length });
    // Issues summary
    const issuesSummary = {
        totalPages: analysis.totalPages,
        totalIssues: allIssues.length,
        highSeverityCount: allIssues.filter(i => i.severity === 'high').length,
        mediumSeverityCount: allIssues.filter(i => i.severity === 'medium').length,
        lowSeverityCount: allIssues.filter(i => i.severity === 'low').length,
        summary: analysis.issuesSummary,
    };
    await writeJSON(path.join(jsonDir, 'issues-summary.json'), issuesSummary);
    // Site structure
    await writeJSON(path.join(jsonDir, 'site-structure.json'), { structure: analysis.siteStructure });
    // All links
    const linksData = {
        internal: analysis.allLinks.filter(l => l.isInternal),
        external: analysis.allLinks.filter(l => !l.isInternal),
        total: analysis.allLinks.length,
    };
    await writeJSON(path.join(jsonDir, 'links.json'), linksData);
    // All images
    await writeJSON(path.join(jsonDir, 'images.json'), { images: analysis.allImages, total: analysis.allImages.length });
    // All headings
    await writeJSON(path.join(jsonDir, 'headings.json'), { headings: analysis.allHeadings, total: analysis.allHeadings.length });
    // Performance data
    const performanceData = analysis.pages.map(p => ({
        url: p.url,
        responseTime: p.performance?.responseTime ?? 0,
        redirectCount: p.performance?.redirectChain?.length ?? 0,
        wordCount: p.contentMetrics?.wordCount ?? 0,
        htmlSize: p.contentMetrics?.htmlSize ?? 0,
        score: scoreMap.get(p.url)?.overallScore ?? null,
    }));
    await writeJSON(path.join(jsonDir, 'performance.json'), { pages: performanceData, total: performanceData.length });
    // External scripts
    await writeJSON(path.join(jsonDir, 'external-scripts.json'), { scripts: analysis.externalScripts, total: analysis.externalScripts.length });
    // 404 pages
    await writeJSON(path.join(jsonDir, '404-pages.json'), { pages404: analysis.pages404, total: analysis.pages404.length });
    // Sitemap info
    if (analysis.sitemapInfo) {
        await writeJSON(path.join(jsonDir, 'sitemap-info.json'), {
            sitemapUrls: analysis.sitemapInfo.sitemapUrls,
            urlsNotInSitemap: analysis.sitemapInfo.urlsNotInSitemap,
            orphanUrls: analysis.sitemapInfo.orphanUrls,
            nonIndexableInSitemap: analysis.sitemapInfo.nonIndexableInSitemap,
            sitemapSize: analysis.sitemapInfo.sitemapSize,
            sitemapUrlCount: analysis.sitemapInfo.sitemapUrlCount,
        });
    }
    // URL index - maps URLs to their safe filenames for easy lookup
    const urlIndex = analysis.pages.reduce((acc, page) => {
        acc[page.url] = createUrlSafeFilename(page.url);
        return acc;
    }, {});
    await writeJSON(path.join(jsonDir, 'url-index.json'), urlIndex);
    // Scoring exports
    await writeJSON(path.join(jsonDir, 'site-score.json'), { ...analysis.siteScore, weights: analysis.appliedScoringWeights });
    await writeJSON(path.join(jsonDir, 'page-scores.json'), analysis.pageScores);
    await writeJSON(path.join(jsonDir, 'score-distribution.json'), {
        distribution: analysis.siteScore.distribution,
        histogram: generateScoreHistogram(analysis.pageScores),
        weights: analysis.appliedScoringWeights,
    });
}
/**
 * Creates a URL-safe filename from a URL
 */
function createUrlSafeFilename(url) {
    try {
        const urlObj = new URL(url);
        // Use pathname + search, replace slashes with dashes, remove leading/trailing dashes
        let filename = (urlObj.pathname + urlObj.search)
            .replace(/^\//, '') // Remove leading slash
            .replace(/\/$/, '') // Remove trailing slash
            .replace(/\//g, '-') // Replace slashes with dashes
            .replace(/[^a-zA-Z0-9-_.]/g, '_'); // Replace special chars with underscore
        // If empty (was just "/"), use "index"
        if (!filename) {
            filename = 'index';
        }
        // Limit length to avoid filesystem issues
        if (filename.length > 200) {
            // Use a hash for very long URLs
            const hash = Buffer.from(url).toString('base64url').substring(0, 40);
            filename = filename.substring(0, 150) + '_' + hash;
        }
        return filename;
    }
    catch {
        // If URL parsing fails, create a safe version from the raw string
        return url
            .replace(/^https?:\/\//, '')
            .replace(/[^a-zA-Z0-9-_.]/g, '_')
            .substring(0, 200);
    }
}
//# sourceMappingURL=jsonExporter.js.map