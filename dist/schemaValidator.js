/**
 * Schema.org / JSON-LD validator
 */
/**
 * Known schema.org types and their required properties
 */
const SCHEMA_REQUIREMENTS = {
    'Article': ['headline', 'image', 'datePublished', 'author'],
    'NewsArticle': ['headline', 'image', 'datePublished', 'author'],
    'BlogPosting': ['headline', 'image', 'datePublished', 'author'],
    'Product': ['name', 'image', 'offers'],
    'Organization': ['name', 'url'],
    'Person': ['name'],
    'Event': ['name', 'startDate', 'location'],
    'Recipe': ['name', 'image', 'author'],
    'Review': ['reviewRating', 'author', 'itemReviewed'],
    'BreadcrumbList': ['itemListElement'],
    'WebPage': ['name'],
    'WebSite': ['name', 'url'],
    'LocalBusiness': ['name', 'address'],
    'VideoObject': ['name', 'description', 'thumbnailUrl', 'uploadDate'],
    'ImageObject': ['contentUrl'],
    'FAQPage': ['mainEntity'],
    'HowTo': ['name', 'step'],
    'JobPosting': ['title', 'description', 'datePosted', 'hiringOrganization'],
};
/**
 * Validates a single JSON-LD object
 */
export function validateJsonLd(jsonLd) {
    const errors = [];
    const warnings = [];
    const types = [];
    // Check if it's an object
    if (!jsonLd || typeof jsonLd !== 'object') {
        return {
            isValid: false,
            errors: ['JSON-LD must be an object'],
            warnings: [],
            types: [],
        };
    }
    // Check for @context
    if (!jsonLd['@context']) {
        errors.push('Missing required @context field');
    }
    else {
        const context = jsonLd['@context'];
        if (typeof context === 'string' && !context.includes('schema.org')) {
            warnings.push(`@context should reference schema.org (found: ${context})`);
        }
    }
    // Check for @type
    if (!jsonLd['@type']) {
        errors.push('Missing required @type field');
    }
    else {
        const type = Array.isArray(jsonLd['@type']) ? jsonLd['@type'][0] : jsonLd['@type'];
        types.push(type);
        // Validate known types
        if (SCHEMA_REQUIREMENTS[type]) {
            const requiredProps = SCHEMA_REQUIREMENTS[type];
            for (const prop of requiredProps) {
                if (!jsonLd[prop]) {
                    errors.push(`Missing required property for ${type}: ${prop}`);
                }
            }
        }
        // Type-specific validation
        validateTypeSpecificProperties(jsonLd, type, errors, warnings);
    }
    // Handle arrays of items (e.g., @graph)
    if (jsonLd['@graph'] && Array.isArray(jsonLd['@graph'])) {
        for (const item of jsonLd['@graph']) {
            const itemValidation = validateJsonLd(item);
            errors.push(...itemValidation.errors);
            warnings.push(...itemValidation.warnings);
            types.push(...itemValidation.types);
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        types,
    };
}
/**
 * Validates type-specific properties
 */
function validateTypeSpecificProperties(jsonLd, type, errors, warnings) {
    // Validate URLs
    const urlFields = ['url', 'image', 'logo', 'sameAs', 'contentUrl', 'thumbnailUrl'];
    for (const field of urlFields) {
        if (jsonLd[field]) {
            const value = jsonLd[field];
            if (typeof value === 'string') {
                if (!isValidUrl(value)) {
                    errors.push(`Invalid URL in ${field}: ${value}`);
                }
            }
            else if (Array.isArray(value)) {
                for (const url of value) {
                    if (typeof url === 'string' && !isValidUrl(url)) {
                        errors.push(`Invalid URL in ${field} array: ${url}`);
                    }
                }
            }
        }
    }
    // Validate dates
    const dateFields = ['datePublished', 'dateModified', 'startDate', 'endDate', 'uploadDate', 'datePosted'];
    for (const field of dateFields) {
        if (jsonLd[field]) {
            const value = jsonLd[field];
            if (typeof value === 'string' && !isValidDate(value)) {
                warnings.push(`Invalid date format in ${field}: ${value} (should be ISO 8601)`);
            }
        }
    }
    // Product-specific validation
    if (type === 'Product' && jsonLd.offers) {
        const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers : [jsonLd.offers];
        for (const offer of offers) {
            if (typeof offer === 'object') {
                if (!offer.price && !offer.priceSpecification) {
                    warnings.push('Product offer missing price');
                }
                if (!offer.priceCurrency) {
                    warnings.push('Product offer missing priceCurrency');
                }
            }
        }
    }
    // Review-specific validation
    if (type === 'Review' && jsonLd.reviewRating) {
        if (typeof jsonLd.reviewRating === 'object') {
            if (!jsonLd.reviewRating.ratingValue) {
                errors.push('Review rating missing ratingValue');
            }
        }
    }
}
/**
 * Checks if a string is a valid URL
 */
function isValidUrl(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
/**
 * Checks if a string is a valid ISO 8601 date
 */
function isValidDate(str) {
    // Basic ISO 8601 patterns
    const iso8601Pattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
    if (!iso8601Pattern.test(str)) {
        return false;
    }
    const date = new Date(str);
    return !isNaN(date.getTime());
}
/**
 * Validates all JSON-LD on a page
 */
export function validateAllJsonLd(jsonLdArray) {
    const allErrors = [];
    const allWarnings = [];
    const allTypes = [];
    for (let i = 0; i < jsonLdArray.length; i++) {
        const result = validateJsonLd(jsonLdArray[i]);
        // Prefix errors/warnings with script index if multiple
        if (jsonLdArray.length > 1) {
            allErrors.push(...result.errors.map((e) => `[Script ${i + 1}] ${e}`));
            allWarnings.push(...result.warnings.map((w) => `[Script ${i + 1}] ${w}`));
        }
        else {
            allErrors.push(...result.errors);
            allWarnings.push(...result.warnings);
        }
        allTypes.push(...result.types);
    }
    return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
        types: Array.from(new Set(allTypes)), // Deduplicate types
    };
}
//# sourceMappingURL=schemaValidator.js.map