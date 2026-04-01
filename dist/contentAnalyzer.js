/**
 * Advanced content analysis including duplicate detection and similarity analysis
 */
import { calculateContentSimilarity, isNearDuplicate, findDuplicatesByHash, } from './utils/contentUtils.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// Get current file directory for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
// Try to load native Rust module for performance
let nativeModule = null;
let useNativeModule = false;
try {
    // Resolve path from project root
    const nativePath = join(__dirname, '..', 'native', 'index.cjs');
    nativeModule = require(nativePath);
    useNativeModule = true;
    // Silently loaded - will be indicated in progress messages
}
catch (error) {
    // Fall back to TypeScript implementation
    useNativeModule = false;
}
/**
 * Finds exact duplicate content across pages
 */
export function findExactDuplicates(pages) {
    const contentPages = [];
    // Apply very relaxed filtering for e-commerce sites: exclude only empty content
    const MIN_WORDS = 20; // Very lenient - reduced from 50 to 20
    const MIN_CONTENT_LENGTH = 50; // Very lenient - reduced from 100 to 50
    for (const page of pages) {
        if (page.contentQuality &&
            page.status === 200 &&
            page.contentMetrics.wordCount >= MIN_WORDS &&
            page.contentQuality.bodyText.length >= MIN_CONTENT_LENGTH) {
            contentPages.push({
                url: page.url,
                hash: page.contentQuality.contentHash,
            });
        }
    }
    const duplicates = findDuplicatesByHash(contentPages);
    // Convert to DuplicateGroup format
    return duplicates.map(dup => ({
        value: `Content hash: ${dup.hash.substring(0, 16)}...`,
        pages: dup.urls,
    }));
}
/**
 * Finds near-duplicate content across pages (>95% similar)
 * Uses Rust native module with LSH for O(n) performance when available,
 * falls back to TypeScript O(n²) implementation otherwise
 */
export function findNearDuplicates(pages, threshold = 0.98) {
    // Apply very relaxed filtering for e-commerce sites: exclude only empty content
    const MIN_WORDS = 20; // Very lenient - reduced from 50 to 20  
    const MIN_CONTENT_LENGTH = 50; // Very lenient - reduced from 100 to 50
    const contentPages = pages.filter(p => p.contentQuality &&
        p.status === 200 &&
        p.contentMetrics.wordCount >= MIN_WORDS &&
        p.contentQuality.bodyText.length >= MIN_CONTENT_LENGTH);
    if (contentPages.length === 0) {
        return [];
    }
    // Use native Rust module if available (much faster with LSH)
    if (useNativeModule && nativeModule) {
        try {
            return findNearDuplicatesNative(contentPages, threshold);
        }
        catch (error) {
            // Silent fallback to TypeScript
            // Fall through to TypeScript implementation
        }
    }
    // TypeScript fallback (O(n²) but works everywhere)
    return findNearDuplicatesTypeScript(contentPages, threshold);
}
/**
 * Returns whether native Rust module is being used
 */
export function isUsingNativeModule() {
    return useNativeModule;
}
/**
 * Fast near-duplicate detection using Rust native module with LSH
 */
function findNearDuplicatesNative(contentPages, threshold) {
    // Prepare input for native module
    const pageInputs = contentPages.map(page => ({
        url: page.url,
        text: getPageText(page),
    }));
    // Use 16 bands × 8 rows = 128 hashes (good for 90-95% similarity detection)
    const bands = 16;
    const rows = 8;
    // Call Rust function
    const results = nativeModule.findNearDuplicates(pageInputs, threshold, bands, rows);
    // Convert to DuplicateGroup format
    const duplicateGroups = [];
    const processed = new Set();
    for (const result of results) {
        if (processed.has(result.url))
            continue;
        if (result.similarPages && result.similarPages.length > 0) {
            const group = [result.url];
            processed.add(result.url);
            for (const similar of result.similarPages) {
                if (!processed.has(similar.url)) {
                    group.push(similar.url);
                    processed.add(similar.url);
                }
            }
            if (group.length > 1) {
                duplicateGroups.push({
                    value: `Similar content (${group.length} pages, ~${(result.similarPages[0]?.similarity * 100 || 0).toFixed(0)}% match)`,
                    pages: group,
                });
            }
        }
    }
    // Sort by number of duplicates
    duplicateGroups.sort((a, b) => b.pages.length - a.pages.length);
    return duplicateGroups;
}
/**
 * TypeScript fallback for near-duplicate detection (O(n²))
 * Only used when Rust native module is not available
 */
function findNearDuplicatesTypeScript(contentPages, threshold) {
    const nearDuplicates = [];
    const processed = new Set();
    // Compare each page with every other page (O(n²) but necessary for similarity)
    for (let i = 0; i < contentPages.length; i++) {
        if (processed.has(contentPages[i].url))
            continue;
        const group = [contentPages[i].url];
        processed.add(contentPages[i].url);
        // Get text content for comparison
        const text1 = getPageText(contentPages[i]);
        for (let j = i + 1; j < contentPages.length; j++) {
            if (processed.has(contentPages[j].url))
                continue;
            const text2 = getPageText(contentPages[j]);
            // Calculate similarity
            const similarity = calculateContentSimilarity(text1, text2);
            if (isNearDuplicate(similarity, threshold)) {
                group.push(contentPages[j].url);
                processed.add(contentPages[j].url);
            }
        }
        // Only add if we found duplicates
        if (group.length > 1) {
            nearDuplicates.push({
                value: `Similar content (${group.length} pages)`,
                pages: group,
            });
        }
    }
    // Sort by number of duplicates
    nearDuplicates.sort((a, b) => b.pages.length - a.pages.length);
    return nearDuplicates;
}
/**
 * Gets text content for a page using stored body text
 */
function getPageText(page) {
    // Use the extracted body text (with boilerplate removed)
    // This provides better duplicate detection than just title + description + headings
    return page.contentQuality?.bodyText || '';
}
/**
 * Finds duplicate H1 tags across pages
 */
export function findDuplicateH1s(pages) {
    const h1Map = new Map();
    for (const page of pages) {
        const h1s = page.headings.filter(h => h.level === 1);
        for (const h1 of h1s) {
            const text = h1.text.trim();
            if (!text)
                continue;
            if (!h1Map.has(text)) {
                h1Map.set(text, []);
            }
            h1Map.get(text).push(page.url);
        }
    }
    // Filter to only duplicates
    const duplicates = [];
    for (const [text, urls] of h1Map.entries()) {
        if (urls.length > 1) {
            duplicates.push({ value: text, pages: urls });
        }
    }
    // Sort by number of pages
    duplicates.sort((a, b) => b.pages.length - a.pages.length);
    return duplicates;
}
/**
 * Finds duplicate H2 tags across pages
 */
export function findDuplicateH2s(pages) {
    const h2Map = new Map();
    for (const page of pages) {
        const h2s = page.headings.filter(h => h.level === 2);
        for (const h2 of h2s) {
            const text = h2.text.trim();
            if (!text)
                continue;
            if (!h2Map.has(text)) {
                h2Map.set(text, []);
            }
            h2Map.get(text).push(page.url);
        }
    }
    // Filter to only duplicates
    const duplicates = [];
    for (const [text, urls] of h2Map.entries()) {
        if (urls.length > 1) {
            duplicates.push({ value: text, pages: urls });
        }
    }
    // Sort by number of pages
    duplicates.sort((a, b) => b.pages.length - a.pages.length);
    return duplicates;
}
/**
 * Analyzes all pages for content quality issues
 */
export function analyzeContentQuality(pages) {
    for (const page of pages) {
        if (!page.contentQuality)
            continue;
        // Check readability
        const readability = page.contentQuality.readabilityScore;
        if (readability.fleschKincaidGrade > 16) {
            page.issues.push({
                message: `Very poor readability (grade level: ${readability.fleschKincaidGrade.toFixed(1)}, requires college+ education)`,
                severity: 'medium',
            });
        }
        // Check if heading hierarchy is broken
        const headingLevels = page.headings.map(h => h.level);
        let hierarchyBroken = false;
        for (let i = 1; i < headingLevels.length; i++) {
            if (headingLevels[i] > headingLevels[i - 1] + 1) {
                hierarchyBroken = true;
                break;
            }
        }
        if (hierarchyBroken) {
            page.issues.push({
                message: 'Heading hierarchy is broken (skipped levels)',
                severity: 'low',
            });
        }
        // Check for overly long headings
        const longHeadings = page.headings.filter(h => h.text.length > 70);
        if (longHeadings.length > 0) {
            page.issues.push({
                message: `${longHeadings.length} heading(s) too long (>70 characters)`,
                severity: 'low',
            });
        }
        // Check for empty headings
        const emptyHeadings = page.headings.filter(h => h.text.trim().length === 0);
        if (emptyHeadings.length > 0) {
            page.issues.push({
                message: `${emptyHeadings.length} empty heading(s)`,
                severity: 'medium',
            });
        }
    }
}
//# sourceMappingURL=contentAnalyzer.js.map