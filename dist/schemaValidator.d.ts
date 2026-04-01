/**
 * Schema.org / JSON-LD validator
 */
import type { SchemaValidationResult } from './types.js';
/**
 * Validates a single JSON-LD object
 */
export declare function validateJsonLd(jsonLd: any): SchemaValidationResult;
/**
 * Validates all JSON-LD on a page
 */
export declare function validateAllJsonLd(jsonLdArray: any[]): SchemaValidationResult;
//# sourceMappingURL=schemaValidator.d.ts.map