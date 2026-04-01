/**
 * Stealth utilities for web scraping
 * Provides user agent rotation, header randomization, and anti-detection techniques
 */
export interface StealthConfig {
    enabled: boolean;
    rotateUserAgents?: boolean;
    randomizeHeaders?: boolean;
    randomizeTimings?: boolean;
    minDelay?: number;
    maxDelay?: number;
    proxyList?: string[];
    customUserAgents?: string[];
}
/**
 * Generate a random user agent
 */
export declare function getRandomUserAgent(customAgents?: string[]): string;
/**
 * Generate realistic browser headers based on user agent
 */
export declare function generateHeaders(userAgent: string, baseHeaders?: Record<string, string>): Record<string, string>;
/**
 * Generate random delay between requests
 */
export declare function getRandomDelay(minMs?: number, maxMs?: number): number;
/**
 * Generate human-like timing patterns
 */
export declare function getHumanLikeDelay(): number;
/**
 * Create stealth request configuration for axios
 */
export declare function createStealthRequestConfig(config: StealthConfig, baseConfig?: any): any;
/**
 * Calculate delay between requests with stealth timing
 */
export declare function calculateStealthDelay(config: StealthConfig, baseDelay?: number): number;
/**
 * Validate and parse proxy list
 */
export declare function validateProxyList(proxies: string[]): string[];
/**
 * Generate session-consistent headers (for maintaining session across requests)
 */
export declare class StealthSession {
    private userAgent;
    private headers;
    private config;
    constructor(config: StealthConfig);
    /**
     * Get consistent headers for this session
     */
    getHeaders(): Record<string, string>;
    /**
     * Get the user agent for this session
     */
    getUserAgent(): string;
    /**
     * Refresh session (new user agent and headers)
     */
    refresh(): void;
    /**
     * Create request config for this session
     */
    createRequestConfig(baseConfig?: any): any;
}
/**
 * Create stealth configuration with sensible defaults
 */
export declare function createStealthConfig(options?: Partial<StealthConfig>): StealthConfig;
//# sourceMappingURL=stealthUtils.d.ts.map