/**
 * Utilities for HTML structure validation
 */
/**
 * Validates HTML structure
 */
export function validateHtmlStructure($, html) {
    const result = {
        hasHead: false,
        hasBody: false,
        multipleHeads: 0,
        multipleBodies: 0,
        elementsOutsideHead: [],
        documentOrderIssues: [],
        htmlSize: Buffer.byteLength(html, 'utf8'),
        domDepth: 0,
        hasDoctype: false,
        deprecatedElements: [],
    };
    // Check for head and body
    const heads = $('head');
    const bodies = $('body');
    result.hasHead = heads.length > 0;
    result.hasBody = bodies.length > 0;
    result.multipleHeads = heads.length;
    result.multipleBodies = bodies.length;
    // Check for elements that should be in head but are elsewhere
    const headOnlyElements = ['title', 'meta', 'link[rel="canonical"]', 'link[rel="alternate"]'];
    for (const selector of headOnlyElements) {
        $(selector).each((_, element) => {
            const $element = $(element);
            const inHead = $element.closest('head').length > 0;
            if (!inHead) {
                const tagName = $element.prop('tagName');
                const desc = getElementDescription($, $element);
                result.elementsOutsideHead.push(`<${tagName}> ${desc}`);
            }
        });
    }
    // Check document order
    if (result.hasHead && result.hasBody) {
        const htmlElement = $('html');
        if (htmlElement.length > 0) {
            const children = htmlElement.children();
            let foundHead = false;
            let foundBody = false;
            children.each((_, child) => {
                const tagName = $(child).prop('tagName')?.toLowerCase();
                if (tagName === 'head') {
                    if (foundBody) {
                        result.documentOrderIssues.push('<head> appears after <body>');
                    }
                    foundHead = true;
                }
                else if (tagName === 'body') {
                    if (!foundHead) {
                        result.documentOrderIssues.push('<body> appears before <head>');
                    }
                    foundBody = true;
                }
            });
        }
    }
    // Calculate DOM depth
    result.domDepth = calculateDomDepth($);
    // Check for doctype
    const doctypeMatch = html.match(/<!DOCTYPE\s+([^>]+)>/i);
    result.hasDoctype = !!doctypeMatch;
    if (doctypeMatch) {
        result.doctypeValue = doctypeMatch[1].trim();
    }
    // Check for deprecated HTML elements
    const deprecatedTags = ['font', 'center', 'marquee', 'blink', 'frame', 'frameset', 'noframes', 'acronym', 'applet', 'basefont', 'big', 'dir', 'strike', 'tt'];
    const foundDeprecated = [];
    for (const tag of deprecatedTags) {
        const elements = $(tag);
        if (elements.length > 0) {
            foundDeprecated.push(`<${tag}> (${elements.length})`);
        }
    }
    result.deprecatedElements = foundDeprecated;
    return result;
}
/**
 * Gets a description of an element for reporting
 */
function getElementDescription(_$, $element) {
    const tagName = $element.prop('tagName')?.toLowerCase();
    if (tagName === 'title') {
        return `"${$element.text().slice(0, 50)}"`;
    }
    if (tagName === 'meta') {
        const name = $element.attr('name') || $element.attr('property');
        if (name) {
            return `[name="${name}"]`;
        }
    }
    if (tagName === 'link') {
        const rel = $element.attr('rel');
        if (rel) {
            return `[rel="${rel}"]`;
        }
    }
    return '';
}
/**
 * Calculates maximum DOM depth
 */
function calculateDomDepth($) {
    let maxDepth = 0;
    function traverse(element, depth) {
        maxDepth = Math.max(maxDepth, depth);
        $(element).children().each((_, child) => {
            traverse(child, depth + 1);
        });
    }
    $('html').each((_, html) => {
        traverse(html, 0);
    });
    return maxDepth;
}
/**
 * Checks if HTML is very large (>1MB)
 */
export function isVeryLargeHtml(htmlSize) {
    return htmlSize > 1024 * 1024; // 1MB
}
/**
 * Checks if DOM depth is excessive (>30 levels)
 */
export function isExcessiveDomDepth(depth) {
    return depth > 30;
}
/**
 * Checks for invalid elements in head
 */
export function findInvalidHeadElements($) {
    const invalidElements = [];
    const validHeadTags = new Set([
        'title', 'base', 'link', 'style', 'meta', 'script', 'noscript', 'template'
    ]);
    $('head').children().each((_, element) => {
        const tagName = $(element).prop('tagName')?.toLowerCase();
        if (tagName && !validHeadTags.has(tagName)) {
            invalidElements.push(`<${tagName}>`);
        }
    });
    return invalidElements;
}
//# sourceMappingURL=htmlValidator.js.map