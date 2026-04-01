import fs from 'fs/promises';
import path from 'path';
/**
 * Escapes a field for CSV format (RFC 4180 compliant)
 */
function escapeCsvField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    const str = String(field);
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
/**
 * Converts an array of objects to CSV string
 */
function arrayToCsv(data, headers) {
    const rows = [];
    // Add header row
    rows.push(headers.map(escapeCsvField).join(','));
    // Add data rows
    for (const item of data) {
        const row = headers.map(header => escapeCsvField(item[header]));
        rows.push(row.join(','));
    }
    return rows.join('\n');
}
/**
 * Generates CSV export files from analysis results
 */
export async function generateCsvExports(analysis, outputDir) {
    console.log(`\nGenerating CSV exports in ${outputDir}...`);
    // Create CSV subdirectory
    const csvDir = path.join(outputDir, 'csv');
    await fs.mkdir(csvDir, { recursive: true });
    // Export all pages
    await exportAllPages(analysis, csvDir);
    // Export links
    await exportLinks(analysis, csvDir);
    // Export images
    await exportImages(analysis, csvDir);
    // Export headings
    await exportHeadings(analysis, csvDir);
    // Export issues summary
    await exportIssuesSummary(analysis, csvDir);
    console.log(`✓ CSV exports: ${csvDir}`);
}
/**
 * Exports all pages to CSV
 */
async function exportAllPages(analysis, csvDir) {
    const data = analysis.pages.map(page => ({
        url: page.url,
        status: page.status,
        title: page.title || '',
        titleLength: page.titleLength || 0,
        metaDescription: page.metaDescription || '',
        descriptionLength: page.metaDescriptionLength || 0,
        h1Count: page.headings.filter(h => h.level === 1).length,
        wordCount: page.contentMetrics.wordCount,
        internalLinks: page.links.filter(l => l.isInternal).length,
        externalLinks: page.links.filter(l => !l.isInternal).length,
        images: page.images.length,
        imagesWithoutAlt: page.images.filter(img => !img.hasAlt).length,
        responseTime: page.performance.responseTime,
        redirects: page.performance.redirectChain.length,
        canonicalUrl: page.canonicalUrl || '',
        robotsDirectives: page.robotsDirectives?.join(', ') || '',
        issuesCount: page.issues.length,
        issues: page.issues.join('; '),
    }));
    const headers = [
        'url', 'status', 'title', 'titleLength', 'metaDescription', 'descriptionLength',
        'h1Count', 'wordCount', 'internalLinks', 'externalLinks', 'images', 'imagesWithoutAlt',
        'responseTime', 'redirects', 'canonicalUrl', 'robotsDirectives', 'issuesCount', 'issues'
    ];
    const csv = arrayToCsv(data, headers);
    await fs.writeFile(path.join(csvDir, 'all-pages.csv'), csv, 'utf-8');
}
/**
 * Exports all links to CSV
 */
async function exportLinks(analysis, csvDir) {
    const data = analysis.allLinks.map(link => ({
        pageUrl: link.pageUrl,
        linkUrl: link.href,
        anchorText: link.text,
        rel: link.rel,
        isInternal: link.isInternal,
        isNofollow: link.isNofollow,
        status: link.status || '',
    }));
    const headers = ['pageUrl', 'linkUrl', 'anchorText', 'rel', 'isInternal', 'isNofollow', 'status'];
    const csv = arrayToCsv(data, headers);
    await fs.writeFile(path.join(csvDir, 'links.csv'), csv, 'utf-8');
}
/**
 * Exports all images to CSV
 */
async function exportImages(analysis, csvDir) {
    const data = analysis.allImages.map(img => ({
        pageUrl: img.pageUrl,
        imageSrc: img.src,
        altText: img.alt,
        hasAlt: img.hasAlt,
        fileSize: img.fileSize || '',
    }));
    const headers = ['pageUrl', 'imageSrc', 'altText', 'hasAlt', 'fileSize'];
    const csv = arrayToCsv(data, headers);
    await fs.writeFile(path.join(csvDir, 'images.csv'), csv, 'utf-8');
}
/**
 * Exports all headings to CSV
 */
async function exportHeadings(analysis, csvDir) {
    const data = analysis.allHeadings.map(heading => ({
        pageUrl: heading.pageUrl,
        level: heading.level,
        text: heading.text,
    }));
    const headers = ['pageUrl', 'level', 'text'];
    const csv = arrayToCsv(data, headers);
    await fs.writeFile(path.join(csvDir, 'headings.csv'), csv, 'utf-8');
}
/**
 * Exports issues summary to CSV
 */
async function exportIssuesSummary(analysis, csvDir) {
    const data = analysis.pages
        .filter(page => page.issues.length > 0)
        .flatMap(page => page.issues.map(issue => ({
        pageUrl: page.url,
        issue: issue.message,
        severity: issue.severity,
    })));
    const headers = ['pageUrl', 'issue', 'severity'];
    const csv = arrayToCsv(data, headers);
    await fs.writeFile(path.join(csvDir, 'issues.csv'), csv, 'utf-8');
}
//# sourceMappingURL=exporter.js.map