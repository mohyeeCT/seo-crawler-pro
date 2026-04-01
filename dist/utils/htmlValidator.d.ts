/**
 * Utilities for HTML structure validation
 */
import type { DollarFunction } from './domLite.js';
/**
 * Validates HTML structure and returns issues
 */
export interface HtmlValidationResult {
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
 * Validates HTML structure
 */
export declare function validateHtmlStructure($: DollarFunction, html: string): HtmlValidationResult;
/**
 * Checks if HTML is very large (>1MB)
 */
export declare function isVeryLargeHtml(htmlSize: number): boolean;
/**
 * Checks if DOM depth is excessive (>30 levels)
 */
export declare function isExcessiveDomDepth(depth: number): boolean;
/**
 * Checks for invalid elements in head
 */
export declare function findInvalidHeadElements($: DollarFunction): string[];
//# sourceMappingURL=htmlValidator.d.ts.map