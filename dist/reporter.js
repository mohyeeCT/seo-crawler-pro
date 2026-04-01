import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import { generateJsonRoutes } from './jsonExporter.js';
import { generateScoreHistogram } from './scorer.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Generates HTML reports from analysis results
 */
export async function generateReports(analysis, outputDir, options) {
    console.log(`\nGenerating reports in ${outputDir}...`);
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    // Generate JSON routes for API-like access
    await generateJsonRoutes(analysis, outputDir);
    // Register Handlebars helpers
    registerHandlebarsHelpers();
    // Load templates
    const templatesDir = path.join(__dirname, '..', 'templates');
    const summaryTemplate = await loadTemplate(path.join(templatesDir, 'summary.hbs'));
    // Generate summary report (with chunked datasets for large sites)
    await generateSummaryReport(analysis, summaryTemplate, outputDir);
    // Optionally generate individual page HTML reports (disabled by default for JSON-first approach)
    if (options?.generatePageHtml) {
        const pageTemplate = await loadTemplate(path.join(templatesDir, 'page.hbs'));
        await generatePageReports(analysis, pageTemplate, outputDir);
        console.log(`✓ Page reports: ${analysis.pages.length} pages`);
    }
    console.log(`✓ Summary report: ${path.join(outputDir, 'index.html')}`);
    console.log(`✓ JSON routes: ${analysis.pages.length} page files + aggregate data in ${path.join(outputDir, 'json')}`);
}
/**
 * Loads a Handlebars template from file
 */
async function loadTemplate(templatePath) {
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    return Handlebars.compile(templateContent);
}
/**
 * Splits a dataset into JSONP chunk files and returns absolute file paths.
 */
async function writeChunkedDataset(type, rows, outDir, chunkSize) {
    const chunks = [];
    let index = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const slice = rows.slice(i, i + chunkSize);
        const chunkIndex = ++index; // 1-based index for readability
        const fileName = `chunk-${String(chunkIndex).padStart(4, '0')}.js`;
        const filePath = path.join(outDir, fileName);
        const payload = `window.__SEO_CHUNK_LOADER__('${type}', ${chunkIndex}, ${JSON.stringify(slice)});`;
        await fs.writeFile(filePath, payload, 'utf-8');
        chunks.push(filePath);
    }
    // Handle empty datasets: still create an empty first chunk to initialize
    if (rows.length === 0) {
        const fileName = `chunk-0001.js`;
        const filePath = path.join(outDir, fileName);
        const payload = `window.__SEO_CHUNK_LOADER__('${type}', 1, []);`;
        await fs.writeFile(filePath, payload, 'utf-8');
        chunks.push(filePath);
    }
    return chunks;
}
/**
 * Builds lightweight row data structures for client-side tables.
 */
function buildUiRowData(analysis) {
    const urlToIndex = new Map();
    const scoreMap = new Map();
    (analysis.pageScores || []).forEach((score, idx) => {
        scoreMap.set(score.url, { overallScore: score.overallScore, grade: score.grade });
        urlToIndex.set(score.url, idx);
    });
    const pages = analysis.pages.map((p, idx) => {
        urlToIndex.set(p.url, idx);
        const h1Count = Array.isArray(p.headings) ? p.headings.filter(h => h.level === 1).length : 0;
        const score = scoreMap.get(p.url);
        return {
            index: idx,
            url: p.url,
            status: p.status,
            title: p.title || '',
            titleLength: p.titleLength ?? (p.title ? p.title.length : 0),
            metaDescriptionLength: p.metaDescriptionLength ?? (p.metaDescription ? p.metaDescription.length : 0),
            h1Count,
            wordCount: p.contentMetrics?.wordCount ?? 0,
            htmlSize: p.contentMetrics?.htmlSize ?? 0,
            linksCount: Array.isArray(p.links) ? p.links.length : 0,
            imagesCount: Array.isArray(p.images) ? p.images.length : 0,
            issuesCount: Array.isArray(p.issues) ? p.issues.length : 0,
            responseTime: p.performance?.responseTime ?? 0,
            redirectCount: Array.isArray(p.performance?.redirectChain) ? p.performance.redirectChain.length : 0,
            score: score ? score.overallScore : null,
            grade: score ? score.grade : null,
        };
    });
    const performance = pages.map(p => ({
        index: p.index,
        url: p.url,
        responseTime: p.responseTime,
        redirectCount: p.redirectCount,
        wordCount: p.wordCount,
        htmlSize: p.htmlSize,
        linksCount: p.linksCount,
        imagesCount: p.imagesCount,
        score: p.score,
    }));
    const linksInternal = (analysis.allLinks || []).filter(l => l.isInternal).map(l => ({
        pageUrl: l.pageUrl,
        href: l.href,
        text: l.text,
        rel: l.rel,
        isNofollow: l.isNofollow,
    }));
    const linksExternal = (analysis.allLinks || []).filter(l => !l.isInternal).map(l => ({
        pageUrl: l.pageUrl,
        href: l.href,
        text: l.text,
        rel: l.rel,
        isNofollow: l.isNofollow,
    }));
    const headings = (analysis.allHeadings || []).map(h => ({
        pageUrl: h.pageUrl,
        level: h.level,
        text: h.text,
    }));
    const images = (analysis.allImages || []).map(img => ({
        pageUrl: img.pageUrl,
        src: img.src,
        alt: img.alt,
        hasAlt: img.hasAlt,
    }));
    const issues = [];
    analysis.pages.forEach((p, idx) => {
        (p.issues || []).forEach(issue => {
            issues.push({ index: idx, url: p.url, message: issue.message, severity: issue.severity });
        });
    });
    const pages404 = (analysis.pages404 || []).map(p => ({
        url: p.url,
        referrersCount: Array.isArray(p.referrers) ? p.referrers.length : 0,
        referrers: p.referrers || [],
    }));
    const sitemapNotIn = [];
    const sitemapOrphans = [];
    const sitemapNonIndexable = [];
    if (analysis.sitemapInfo) {
        for (const u of analysis.sitemapInfo.urlsNotInSitemap || []) {
            const idx = urlToIndex.get(u);
            if (idx !== undefined) {
                const p = analysis.pages[idx];
                const hasNoindex = (p.robotsDirectives || []).includes('noindex');
                sitemapNotIn.push({ url: p.url, index: idx, status: p.status, indexable: !hasNoindex });
            }
            else {
                sitemapNotIn.push({ url: u, index: null, status: null, indexable: null });
            }
        }
        for (const u of analysis.sitemapInfo.orphanUrls || []) {
            sitemapOrphans.push({ url: u });
        }
        for (const u of analysis.sitemapInfo.nonIndexableInSitemap || []) {
            const idx = urlToIndex.get(u);
            if (idx !== undefined) {
                const p = analysis.pages[idx];
                const hasNoindex = (p.robotsDirectives || []).includes('noindex');
                const reasons = p.indexability?.reasons || [];
                sitemapNonIndexable.push({ url: p.url, index: idx, status: p.status, noindex: hasNoindex, reasons: reasons.join('; ') });
            }
            else {
                sitemapNonIndexable.push({ url: u, index: null, status: null, noindex: true, reasons: 'Not crawled' });
            }
        }
    }
    const scriptsByPage = [];
    analysis.pages.forEach((p, idx) => {
        const scripts = p.externalScripts || [];
        if (scripts.length) {
            scriptsByPage.push({ index: idx, url: p.url, count: scripts.length, scripts });
        }
    });
    return {
        pages,
        performance,
        linksInternal,
        linksExternal,
        headings,
        images,
        issues,
        pages404,
        sitemapNotIn,
        sitemapOrphans,
        sitemapNonIndexable,
        scriptsByPage,
    };
}
/**
 * Generates the summary report (index.html)
 */
async function generateSummaryReport(analysis, template, outputDir) {
    // Calculate total issues by severity
    const totalHighSeverity = analysis.pages.reduce((sum, page) => sum + page.issues.filter(i => i.severity === 'high').length, 0);
    const totalMediumSeverity = analysis.pages.reduce((sum, page) => sum + page.issues.filter(i => i.severity === 'medium').length, 0);
    const totalLowSeverity = analysis.pages.reduce((sum, page) => sum + page.issues.filter(i => i.severity === 'low').length, 0);
    // Build lightweight UI rows and write chunked datasets
    const uiData = buildUiRowData(analysis);
    const dataRoot = path.join(outputDir, 'data');
    await fs.mkdir(dataRoot, { recursive: true });
    const chunkSize = 500; // threshold chunk size
    const manifest = {};
    // Helper to write a dataset and record in manifest
    async function writeDataset(name, rows) {
        const relDir = path.join('data', name);
        const absDir = path.join(outputDir, name === '.' ? 'data' : relDir);
        await fs.mkdir(absDir, { recursive: true });
        const chunkFiles = await writeChunkedDataset(name, rows, absDir, chunkSize);
        manifest[name] = { total: rows.length, chunks: chunkFiles.map(f => path.join(relDir, path.basename(f))) };
    }
    // Always write chunked datasets (even if small -> 1 chunk) for simplicity and consistency
    await writeDataset('pages', uiData.pages);
    await writeDataset('performance', uiData.performance);
    await writeDataset('links_internal', uiData.linksInternal);
    await writeDataset('links_external', uiData.linksExternal);
    await writeDataset('headings', uiData.headings);
    await writeDataset('images', uiData.images);
    await writeDataset('issues', uiData.issues);
    await writeDataset('pages404', uiData.pages404);
    if (uiData.sitemapNotIn.length)
        await writeDataset('sitemap_not_in', uiData.sitemapNotIn);
    if (uiData.sitemapOrphans.length)
        await writeDataset('sitemap_orphans', uiData.sitemapOrphans);
    if (uiData.sitemapNonIndexable.length)
        await writeDataset('sitemap_nonindexable', uiData.sitemapNonIndexable);
    if (uiData.scriptsByPage.length)
        await writeDataset('scripts_by_page', uiData.scriptsByPage);
    // Copy client runtime script to output
    const clientJsPath = path.join(__dirname, '..', 'templates', 'report.js');
    try {
        const clientJs = await fs.readFile(clientJsPath, 'utf-8');
        await fs.writeFile(path.join(outputDir, 'report.js'), clientJs, 'utf-8');
    }
    catch {
        // If missing at build time, emit a minimal bootstrap to avoid breaking the report
        const minimal = `window.__SEO_MANIFEST__=window.__SEO_MANIFEST__||{};window.__SEO_CHUNK_LOADER__=function(){};window.initReport=function(){console.warn('report.js missing')};`;
        await fs.writeFile(path.join(outputDir, 'report.js'), minimal, 'utf-8');
    }
    // Copy page viewer HTML to output
    const pageViewerPath = path.join(__dirname, '..', 'templates', 'page-viewer.html');
    try {
        const pageViewerHtml = await fs.readFile(pageViewerPath, 'utf-8');
        await fs.writeFile(path.join(outputDir, 'page-viewer.html'), pageViewerHtml, 'utf-8');
    }
    catch (error) {
        console.warn('Warning: Could not copy page-viewer.html');
    }
    // Create manifest inline script tag
    const manifestScript = `<script>window.__SEO_MANIFEST__=${JSON.stringify(manifest)};<\/script>`;
    // Calculate performance and content statistics for overview
    const fastPages = analysis.pages.filter(p => p.performance.responseTime < 1000).length;
    const moderatePages = analysis.pages.filter(p => p.performance.responseTime >= 1000 && p.performance.responseTime <= 3000).length;
    const slowPages = analysis.pages.filter(p => p.performance.responseTime > 3000).length;
    const goodContentPages = analysis.pages.filter(p => p.contentMetrics.wordCount > 300).length;
    const thinContentPages = analysis.pages.filter(p => p.contentMetrics.wordCount <= 300).length;
    const scoreHistogram = generateScoreHistogram(analysis.pageScores);
    const context = {
        timestamp: new Date().toLocaleString(),
        totalPages: analysis.totalPages,
        issuesSummary: analysis.issuesSummary,
        totalHighSeverity,
        totalMediumSeverity,
        totalLowSeverity,
        // Performance stats for overview
        fastPages,
        moderatePages,
        slowPages,
        goodContentPages,
        thinContentPages,
        // Keep small objects as-is for overview and structure
        siteStructure: analysis.siteStructure,
        externalScripts: analysis.externalScripts,
        sitemapInfo: analysis.sitemapInfo,
        // Provide counts for headings/images
        allHeadingsCount: analysis.allHeadings.length,
        allImagesCount: analysis.allImages.length,
        // Inline manifest for client loader
        manifestScript,
        siteScore: analysis.siteScore,
        pageScores: analysis.pageScores,
        scoreHistogram,
        scoringWeights: analysis.appliedScoringWeights,
    };
    const html = template(context);
    const outputPath = path.join(outputDir, 'index.html');
    await fs.writeFile(outputPath, html, 'utf-8');
}
/**
 * Generates individual page detail reports
 */
async function generatePageReports(analysis, template, outputDir) {
    const scoreMap = new Map();
    (analysis.pageScores || []).forEach(score => {
        scoreMap.set(score.url, score);
    });
    for (let i = 0; i < analysis.pages.length; i++) {
        const page = analysis.pages[i];
        const score = scoreMap.get(page.url) ?? null;
        const html = template({ ...page, score });
        const outputPath = path.join(outputDir, `page-${i}.html`);
        await fs.writeFile(outputPath, html, 'utf-8');
    }
}
/**
 * Registers custom Handlebars helpers
 */
function registerHandlebarsHelpers() {
    // Helper to check equality
    Handlebars.registerHelper('eq', function (a, b) {
        return a === b;
    });
    // Helper to check greater than
    Handlebars.registerHelper('gt', function (a, b) {
        return a > b;
    });
    Handlebars.registerHelper('formatScore', function (value, decimals = 1) {
        if (value === null || value === undefined || Number.isNaN(Number(value)))
            return '—';
        return Number(value).toFixed(decimals);
    });
    Handlebars.registerHelper('formatWeight', function (value, decimals = 0) {
        const num = Number(value);
        if (Number.isNaN(num))
            return '—';
        return `${(num * 100).toFixed(decimals)}%`;
    });
    Handlebars.registerHelper('scoreClass', function (grade) {
        switch (grade) {
            case 'excellent': return 'score-badge excellent';
            case 'good': return 'score-badge good';
            case 'fair': return 'score-badge fair';
            case 'poor': return 'score-badge poor';
            case 'critical': return 'score-badge critical';
            default: return 'score-badge';
        }
    });
    Handlebars.registerHelper('scoreGrade', function (value) {
        const score = Number(value);
        if (Number.isNaN(score))
            return 'unknown';
        if (score >= 90)
            return 'excellent';
        if (score >= 80)
            return 'good';
        if (score >= 70)
            return 'fair';
        if (score >= 50)
            return 'poor';
        return 'critical';
    });
    Handlebars.registerHelper('scoreCategoryLabel', function (category) {
        const labels = {
            technical: 'Technical SEO',
            content: 'Content Quality',
            onPage: 'On-Page SEO',
            links: 'Links & Architecture',
            security: 'Security',
            performance: 'Performance',
        };
        return labels[category] || category;
    });
    // Helper to check less than
    Handlebars.registerHelper('lt', function (a, b) {
        return a < b;
    });
    // Helper to add numbers
    Handlebars.registerHelper('add', function (...args) {
        // Remove the options object (last argument)
        const numbers = args.slice(0, -1);
        return numbers.reduce((sum, num) => sum + (num || 0), 0);
    });
    // Helper to check if string includes substring
    Handlebars.registerHelper('includes', function (str, substr) {
        return str && str.includes(substr);
    });
    // Helper to check if object has properties
    Handlebars.registerHelper('hasOpenGraph', function (obj) {
        return obj && Object.keys(obj).length > 0;
    });
    Handlebars.registerHelper('hasTwitterCards', function (obj) {
        return obj && Object.keys(obj).length > 0;
    });
    // Helper to format JSON
    Handlebars.registerHelper('json', function (context) {
        return JSON.stringify(context, null, 2);
    });
    // Helper to filter arrays
    Handlebars.registerHelper('filter', function (array, options) {
        if (!Array.isArray(array))
            return [];
        const hash = options.hash;
        if (!hash || Object.keys(hash).length === 0)
            return array;
        return array.filter(item => {
            for (const [key, value] of Object.entries(hash)) {
                if (item[key] !== value)
                    return false;
            }
            return true;
        });
    });
    // Helper to count links with filter
    Handlebars.registerHelper('countLinks', function (links, options) {
        if (!Array.isArray(links))
            return 0;
        const internal = options.hash.internal;
        if (internal === undefined)
            return links.length;
        return links.filter(link => link.isInternal === internal).length;
    });
    // Helper to get length
    Handlebars.registerHelper('length', function (array) {
        if (Array.isArray(array))
            return array.length;
        return 0;
    });
    // Helper to divide numbers
    Handlebars.registerHelper('divide', function (a, b) {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (isNaN(numA) || isNaN(numB) || numB === 0)
            return 0;
        return Math.round((numA / numB) * 10) / 10; // Round to 1 decimal
    });
    // Helper to calculate percentage
    Handlebars.registerHelper('percentage', function (a, b) {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (isNaN(numA) || isNaN(numB) || numB === 0)
            return 0;
        return Math.round((numA / numB) * 100);
    });
    // Helper to count images without alt text
    Handlebars.registerHelper('countMissing', function (images, options) {
        if (!Array.isArray(images))
            return options.fn(0);
        const missingCount = images.filter(img => !img.hasAlt).length;
        return options.fn(missingCount);
    });
    // Helper to count H1 headings
    Handlebars.registerHelper('countH1', function (headings, options) {
        if (!Array.isArray(headings))
            return options.fn(0);
        const h1Count = headings.filter(h => h.level === 1).length;
        return options.fn(h1Count);
    });
    // Helper to multiply numbers
    Handlebars.registerHelper('multiply', function (a, options) {
        const num = parseFloat(a);
        if (isNaN(num))
            return options.fn(0);
        return options.fn(num);
    });
    // Helper to count fast pages
    Handlebars.registerHelper('countFast', function (pages, options) {
        if (!Array.isArray(pages))
            return options.fn(0);
        const count = pages.filter(p => p.performance.responseTime < 1000).length;
        return options.fn(count);
    });
    // Helper to count moderate pages
    Handlebars.registerHelper('countModerate', function (pages, options) {
        if (!Array.isArray(pages))
            return options.fn(0);
        const count = pages.filter(p => p.performance.responseTime >= 1000 && p.performance.responseTime <= 3000).length;
        return options.fn(count);
    });
    // Helper to count slow pages
    Handlebars.registerHelper('countSlow', function (pages, options) {
        if (!Array.isArray(pages))
            return options.fn(0);
        const count = pages.filter(p => p.performance.responseTime > 3000).length;
        return options.fn(count);
    });
    // Helper to count good content pages
    Handlebars.registerHelper('countGoodContent', function (pages, options) {
        if (!Array.isArray(pages))
            return options.fn(0);
        const count = pages.filter(p => p.contentMetrics.wordCount > 300).length;
        return options.fn(count);
    });
    // Helper to count thin content pages
    Handlebars.registerHelper('countThinContent', function (pages, options) {
        if (!Array.isArray(pages))
            return options.fn(0);
        const count = pages.filter(p => p.contentMetrics.wordCount <= 300).length;
        return options.fn(count);
    });
    // Helper to count internal links
    Handlebars.registerHelper('countInternal', function (links, options) {
        if (!Array.isArray(links))
            return options.fn(0);
        const count = links.filter(l => l.isInternal).length;
        return options.fn(count);
    });
    // Helper to count external links
    Handlebars.registerHelper('countExternal', function (links, options) {
        if (!Array.isArray(links))
            return options.fn(0);
        const count = links.filter(l => !l.isInternal).length;
        return options.fn(count);
    });
    // Helper to truncate URLs
    Handlebars.registerHelper('truncateUrl', function (url, maxLength = 80) {
        if (!url || url.length <= maxLength)
            return url;
        // Try to intelligently truncate
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname + urlObj.search;
            if (path.length > maxLength - 20) {
                // Show domain + truncated path
                return urlObj.hostname + path.substring(0, maxLength - urlObj.hostname.length - 3) + '...';
            }
            return url.substring(0, maxLength) + '...';
        }
        catch {
            return url.substring(0, maxLength) + '...';
        }
    });
    // Helper to count issues by severity
    Handlebars.registerHelper('countBySeverity', function (issues, severity) {
        if (!Array.isArray(issues))
            return 0;
        return issues.filter(i => i.severity === severity).length;
    });
    // Helper to filter issues by severity
    Handlebars.registerHelper('filterBySeverity', function (issues, severity) {
        if (!Array.isArray(issues))
            return [];
        return issues.filter(i => i.severity === severity);
    });
    // Helper to get severity badge class
    Handlebars.registerHelper('severityClass', function (severity) {
        switch (severity) {
            case 'high': return 'badge-error';
            case 'medium': return 'badge-warning';
            case 'low': return 'badge-info';
            default: return 'badge-info';
        }
    });
    // Helper to get severity label
    Handlebars.registerHelper('severityLabel', function (severity) {
        switch (severity) {
            case 'high': return 'High';
            case 'medium': return 'Medium';
            case 'low': return 'Low';
            default: return 'Unknown';
        }
    });
    // Helper to check if array has items
    Handlebars.registerHelper('hasItems', function (array) {
        return Array.isArray(array) && array.length > 0;
    });
    // Helper to find a page by URL
    Handlebars.registerHelper('findPage', function (url, pages) {
        return pages.find((p) => p.url === url);
    });
    // Helper to check if page has noindex
    Handlebars.registerHelper('hasNoindex', function (robotsDirectives) {
        return robotsDirectives && robotsDirectives.includes('noindex');
    });
    // Helper for greater than comparison
    Handlebars.registerHelper('gt', function (a, b) {
        return a > b;
    });
    // Helper for not equal comparison
    Handlebars.registerHelper('ne', function (a, b) {
        return a !== b;
    });
    // Helper to determine issue severity from category and percentage
    Handlebars.registerHelper('issueSeverity', function (category, percentageAffected) {
        // Determine severity based on category and how widespread the issue is
        const percentage = Number(percentageAffected);
        // Security and technical issues affecting many pages are critical
        if ((category === 'security' || category === 'technical') && percentage > 50) {
            return 'critical';
        }
        // Content issues affecting majority of pages are high
        if (category === 'content' && percentage > 70) {
            return 'high';
        }
        // OnPage issues affecting many pages are high
        if (category === 'onPage' && percentage > 60) {
            return 'high';
        }
        // Performance issues are typically medium unless extremely widespread
        if (category === 'performance') {
            return percentage > 80 ? 'high' : 'medium';
        }
        // Links issues are generally medium
        if (category === 'links') {
            return percentage > 50 ? 'medium' : 'low';
        }
        // Default severity based on percentage
        if (percentage > 80)
            return 'high';
        if (percentage > 50)
            return 'medium';
        return 'low';
    });
    // Helper to get severity label for issues
    Handlebars.registerHelper('issueSeverityLabel', function (category, percentageAffected) {
        const percentage = Number(percentageAffected);
        if ((category === 'security' || category === 'technical') && percentage > 50) {
            return 'Critical';
        }
        if ((category === 'content' && percentage > 70) ||
            (category === 'onPage' && percentage > 60) ||
            (category === 'performance' && percentage > 80)) {
            return 'High';
        }
        if (percentage > 80)
            return 'High';
        if (percentage > 50)
            return 'Medium';
        if (percentage > 20)
            return 'Low';
        return 'Info';
    });
    // Helper to get severity priority for sorting (lower = more severe)
    const getSeverityPriority = (category, percentageAffected) => {
        const percentage = Number(percentageAffected);
        if ((category === 'security' || category === 'technical') && percentage > 50) {
            return 1; // Critical
        }
        if ((category === 'content' && percentage > 70) ||
            (category === 'onPage' && percentage > 60) ||
            (category === 'performance' && percentage > 80)) {
            return 2; // High
        }
        if (percentage > 80)
            return 2; // High
        if (percentage > 50)
            return 3; // Medium
        if (percentage > 20)
            return 4; // Low
        return 5; // Info
    };
    // Helper to sort top issues by severity
    Handlebars.registerHelper('sortBySeverity', function (issues) {
        if (!Array.isArray(issues))
            return [];
        return issues.slice().sort((a, b) => {
            const priorityA = getSeverityPriority(a.category, a.percentageAffected);
            const priorityB = getSeverityPriority(b.category, b.percentageAffected);
            // Sort by severity first (lower priority = more severe)
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            // Then by percentage affected (descending)
            return b.percentageAffected - a.percentageAffected;
        });
    });
    // Helper to render site structure recursively
    Handlebars.registerHelper('renderStructure', function (nodes, level = 0) {
        if (!Array.isArray(nodes) || nodes.length === 0)
            return '';
        let html = '';
        for (const node of nodes) {
            const hasPage = node.pageData;
            const issueCount = hasPage ? node.pageData.issues.length : 0;
            const statusBadge = hasPage ? `<span class="badge badge-${node.pageData.status === 200 ? 'success' : 'error'}">${node.pageData.status}</span>` : '';
            const issueBadge = hasPage && issueCount > 0 ? `<span class="badge badge-warning">${issueCount} issues</span>` : '';
            const urlParam = hasPage ? `page-viewer.html?url=${encodeURIComponent(node.pageData.url)}` : node.fullUrl;
            const openAttrs = hasPage ? '' : ` target="_blank" rel="noopener"`;
            html += `<div class="tree-node" style="margin-left: ${level * 20}px;">`;
            html += `<span class="tree-icon">${node.children.length > 0 ? '📁' : '📄'}</span> `;
            html += `<a class="tree-path" href="${urlParam}"${openAttrs}>${node.path}</a> `;
            html += statusBadge;
            html += ' ';
            html += issueBadge;
            html += `</div>`;
            if (node.children && node.children.length > 0) {
                html += Handlebars.helpers['renderStructure'](node.children, level + 1);
            }
        }
        return new Handlebars.SafeString(html);
    });
}
//# sourceMappingURL=reporter.js.map