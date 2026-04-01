/**
 * Utilities for content analysis including hashing and similarity detection
 */
import crypto from 'crypto';
/**
 * Cleans text for comparison (removes whitespace, punctuation, lowercase)
 */
export function cleanTextForComparison(text) {
    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim();
}
/**
 * Generates SHA-256 hash of content for exact duplicate detection
 * Designed to distinguish between pages with similar structure but different content
 */
export function generateContentHash(content) {
    // For e-commerce sites, we need to preserve key distinguishing features
    // while normalizing common boilerplate variations
    // Extract key unique elements first (preserve these in hash)
    const headings = (content.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi) || []).join(' ');
    const prices = (content.match(/\$[\d,.]+|€[\d,.]+|£[\d,.]+|¥[\d,.]+/g) || []).join(' ');
    const productIds = (content.match(/\b(?:sku|id|model|part)\s*:?\s*[a-z0-9\-_]+/gi) || []).join(' ');
    const normalized = content
        .toLowerCase()
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Remove common boilerplate that varies between pages
        .replace(/copyright \d{4}/gi, 'copyright YEAR')
        .replace(/all rights reserved\./gi, 'all rights reserved')
        // Remove timestamps but preserve dates in content
        .replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+\d{1,2}:\d{2}/g, 'DATETIME')
        // Remove session IDs and tracking parameters
        .replace(/[?&]utm_[^=]+=[^&]+/g, '')
        .replace(/[?&]session[^=]*=[^&]+/g, '')
        .replace(/[?&]_[^=]+=[^&]+/g, '')
        .trim();
    // Create hash that includes both normalized content and key unique elements
    const hashInput = normalized + '|UNIQUE:' + headings + '|' + prices + '|' + productIds;
    return crypto.createHash('sha256').update(hashInput).digest('hex');
}
/**
 * Generates n-grams from text (for shingling)
 */
export function generateNGrams(text, n = 3) {
    const cleaned = cleanTextForComparison(text);
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    const ngrams = new Set();
    for (let i = 0; i <= words.length - n; i++) {
        const ngram = words.slice(i, i + n).join(' ');
        ngrams.add(ngram);
    }
    return ngrams;
}
/**
 * Creates a MinHash signature for similarity detection
 */
export function createMinHashSignature(ngrams, numHashes = 128) {
    const signature = new Array(numHashes).fill(Infinity);
    for (const ngram of ngrams) {
        // Generate hash for this n-gram
        const hash = simpleHash(ngram);
        // Update signature with permutations
        for (let i = 0; i < numHashes; i++) {
            const permutedHash = (hash * (i + 1)) % 2147483647;
            signature[i] = Math.min(signature[i], permutedHash);
        }
    }
    return signature;
}
/**
 * Simple hash function for strings
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}
/**
 * Calculates Jaccard similarity between two MinHash signatures
 */
export function calculateJaccardSimilarity(sig1, sig2) {
    if (sig1.length !== sig2.length) {
        throw new Error('Signatures must have the same length');
    }
    let matches = 0;
    for (let i = 0; i < sig1.length; i++) {
        if (sig1[i] === sig2[i]) {
            matches++;
        }
    }
    return matches / sig1.length;
}
/**
 * Calculates content similarity between two texts (0-1 scale)
 * Enhanced for e-commerce content discrimination
 */
export function calculateContentSimilarity(text1, text2) {
    // Extract key discriminating features first
    const features1 = extractKeyFeatures(text1);
    const features2 = extractKeyFeatures(text2);
    // If key features are very different, reduce similarity significantly
    const featureSimilarity = compareKeyFeatures(features1, features2);
    // Use 5-grams for content similarity
    const ngrams1 = generateNGrams(text1, 5);
    const ngrams2 = generateNGrams(text2, 5);
    if (ngrams1.size === 0 || ngrams2.size === 0) {
        return 0;
    }
    const signature1 = createMinHashSignature(ngrams1);
    const signature2 = createMinHashSignature(ngrams2);
    const contentSimilarity = calculateJaccardSimilarity(signature1, signature2);
    // Combine content similarity with feature similarity
    // If features are very different, penalize the overall similarity
    return contentSimilarity * featureSimilarity;
}
/**
 * Checks if content is an exact duplicate
 */
export function isExactDuplicate(hash1, hash2) {
    return hash1 === hash2;
}
/**
 * Checks if content is a near duplicate (>90% similar)
 */
export function isNearDuplicate(similarity, threshold = 0.90) {
    return similarity >= threshold;
}
/**
 * Detects lorem ipsum placeholder text
 */
export function hasLoremIpsum(text) {
    const loremPatterns = [
        /lorem ipsum/i,
        /dolor sit amet/i,
        /consectetur adipiscing/i,
        /sed do eiusmod/i,
        /tempor incididunt/i,
        /ut labore et dolore/i,
    ];
    for (const pattern of loremPatterns) {
        if (pattern.test(text)) {
            return true;
        }
    }
    return false;
}
/**
 * Detects potential soft 404 (page returns 200 but shows "not found" content)
 */
export function isSoft404Content(text, wordCount) {
    // Must have low word count
    if (wordCount > 100) {
        return false;
    }
    const soft404Patterns = [
        /404/,
        /not found/i,
        /page.*not.*found/i,
        /page.*does.*not.*exist/i,
        /can'?t find/i,
        /couldn'?t find/i,
        /no.*found/i,
        /page.*removed/i,
        /page.*deleted/i,
    ];
    const lowerText = text.toLowerCase();
    let matches = 0;
    for (const pattern of soft404Patterns) {
        if (pattern.test(lowerText)) {
            matches++;
        }
    }
    // At least 2 patterns match in low-content page
    return matches >= 2;
}
/**
 * Calculates content-to-code ratio
 */
export function calculateContentToCodeRatio(textLength, htmlSize) {
    if (htmlSize === 0)
        return 0;
    return textLength / htmlSize;
}
/**
 * Extract key discriminating features from content
 */
function extractKeyFeatures(content) {
    const headings = (content.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi) || [])
        .map(h => h.replace(/<[^>]+>/g, '').trim().toLowerCase());
    const prices = content.match(/\$[\d,.]+|€[\d,.]+|£[\d,.]+|¥[\d,.]+/g) || [];
    const productIds = (content.match(/\b(?:sku|id|model|part)\s*:?\s*[a-z0-9\-_]+/gi) || [])
        .map(id => id.toLowerCase());
    // Extract unique meaningful words (>3 chars, not common words)
    const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
    const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const uniqueWords = new Set(words.filter(word => !commonWords.has(word)));
    return {
        headings,
        prices,
        productIds,
        uniqueWords,
    };
}
/**
 * Compare key features between two contents
 * Returns a penalty factor (0.1 to 1.0) based on feature differences
 */
function compareKeyFeatures(features1, features2) {
    // If headings are completely different, heavily penalize
    const headingOverlap = calculateSetOverlap(new Set(features1.headings), new Set(features2.headings));
    if (headingOverlap < 0.3) {
        return 0.3; // Major penalty
    }
    // If prices are completely different, penalize
    if (features1.prices.length > 0 && features2.prices.length > 0) {
        const priceOverlap = calculateSetOverlap(new Set(features1.prices), new Set(features2.prices));
        if (priceOverlap < 0.1) {
            return 0.5; // Moderate penalty
        }
    }
    // If product IDs are completely different, penalize
    if (features1.productIds.length > 0 && features2.productIds.length > 0) {
        const idOverlap = calculateSetOverlap(new Set(features1.productIds), new Set(features2.productIds));
        if (idOverlap < 0.1) {
            return 0.4; // Moderate penalty
        }
    }
    // Compare unique word overlap
    const wordOverlap = calculateSetOverlap(features1.uniqueWords, features2.uniqueWords);
    if (wordOverlap < 0.2) {
        return 0.6; // Light penalty
    }
    return 1.0; // No penalty
}
/**
 * Calculate overlap between two sets (0-1 scale)
 */
function calculateSetOverlap(set1, set2) {
    if (set1.size === 0 && set2.size === 0)
        return 1.0;
    if (set1.size === 0 || set2.size === 0)
        return 0.0;
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
}
export function findDuplicatesByHash(pages) {
    const hashMap = new Map();
    for (const page of pages) {
        if (!hashMap.has(page.hash)) {
            hashMap.set(page.hash, []);
        }
        hashMap.get(page.hash).push(page.url);
    }
    // Filter to only groups with duplicates
    const duplicates = [];
    for (const [hash, urls] of hashMap.entries()) {
        if (urls.length > 1) {
            duplicates.push({ hash, urls });
        }
    }
    // Sort by number of duplicates (most first)
    duplicates.sort((a, b) => b.urls.length - a.urls.length);
    return duplicates;
}
//# sourceMappingURL=contentUtils.js.map