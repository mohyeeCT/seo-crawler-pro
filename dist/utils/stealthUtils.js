/**
 * Stealth utilities for web scraping
 * Provides user agent rotation, header randomization, and anti-detection techniques
 */
// Realistic user agents from recent browsers
const DEFAULT_USER_AGENTS = [
    // Chrome (Windows)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    // Chrome (macOS)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    // Chrome (Linux)
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    // Firefox (Windows)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0',
    // Firefox (macOS)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:119.0) Gecko/20100101 Firefox/119.0',
    // Firefox (Linux)
    'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:119.0) Gecko/20100101 Firefox/119.0',
    // Safari (macOS)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    // Edge (Windows)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    // Edge (macOS)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];
// Common browser headers that vary between requests
const COMMON_HEADERS = {
    'Accept': [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    ],
    'Accept-Language': [
        'en-US,en;q=0.9',
        'en-US,en;q=0.8',
        'en-US,en;q=0.9,es;q=0.8',
        'en-US,en;q=0.9,fr;q=0.8',
        'en-GB,en;q=0.9',
        'en-CA,en;q=0.9',
    ],
    'Accept-Encoding': [
        'gzip, deflate, br',
        'gzip, deflate',
        'gzip, deflate, br, zstd',
    ],
    'Connection': [
        'keep-alive',
    ],
    'Upgrade-Insecure-Requests': [
        '1',
    ],
    'Sec-Fetch-Dest': [
        'document',
    ],
    'Sec-Fetch-Mode': [
        'navigate',
    ],
    'Sec-Fetch-Site': [
        'none',
        'same-origin',
        'cross-site',
    ],
    'Cache-Control': [
        'max-age=0',
        'no-cache',
    ],
    'DNT': [
        '1',
        '0',
    ],
};
// Browser-specific header sets (reserved for future use)
/**
 * Generate a random user agent
 */
export function getRandomUserAgent(customAgents) {
    const agents = customAgents && customAgents.length > 0 ? customAgents : DEFAULT_USER_AGENTS;
    return agents[Math.floor(Math.random() * agents.length)];
}
/**
 * Generate realistic browser headers based on user agent
 */
export function generateHeaders(userAgent, baseHeaders = {}) {
    const headers = { ...baseHeaders };
    // Always set the user agent
    headers['User-Agent'] = userAgent;
    // Add common headers with some randomization
    headers['Accept'] = getRandomValue(COMMON_HEADERS['Accept']);
    headers['Accept-Language'] = getRandomValue(COMMON_HEADERS['Accept-Language']);
    headers['Accept-Encoding'] = getRandomValue(COMMON_HEADERS['Accept-Encoding']);
    headers['Connection'] = getRandomValue(COMMON_HEADERS['Connection']);
    headers['Upgrade-Insecure-Requests'] = getRandomValue(COMMON_HEADERS['Upgrade-Insecure-Requests']);
    // Add sec-fetch headers with some probability
    if (Math.random() > 0.3) {
        headers['Sec-Fetch-Dest'] = getRandomValue(COMMON_HEADERS['Sec-Fetch-Dest']);
        headers['Sec-Fetch-Mode'] = getRandomValue(COMMON_HEADERS['Sec-Fetch-Mode']);
        headers['Sec-Fetch-Site'] = getRandomValue(COMMON_HEADERS['Sec-Fetch-Site']);
    }
    // Add cache-control occasionally
    if (Math.random() > 0.6) {
        headers['Cache-Control'] = getRandomValue(COMMON_HEADERS['Cache-Control']);
    }
    // Add DNT occasionally
    if (Math.random() > 0.7) {
        headers['DNT'] = getRandomValue(COMMON_HEADERS['DNT']);
    }
    // Add Chrome-specific headers if it's a Chrome user agent
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        if (Math.random() > 0.4) {
            headers['sec-ch-ua'] = generateChromeSecChUa(userAgent);
            headers['sec-ch-ua-mobile'] = '?0';
            headers['sec-ch-ua-platform'] = generateChromePlatform(userAgent);
        }
    }
    return headers;
}
/**
 * Generate Chrome sec-ch-ua header
 */
function generateChromeSecChUa(userAgent) {
    const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
    const version = chromeMatch ? chromeMatch[1] : '120';
    return `"Not_A Brand";v="8", "Chromium";v="${version}", "Google Chrome";v="${version}"`;
}
/**
 * Generate Chrome platform header
 */
function generateChromePlatform(userAgent) {
    if (userAgent.includes('Windows'))
        return '"Windows"';
    if (userAgent.includes('Macintosh'))
        return '"macOS"';
    if (userAgent.includes('Linux'))
        return '"Linux"';
    return '"Unknown"';
}
/**
 * Get random value from array
 */
function getRandomValue(array) {
    return array[Math.floor(Math.random() * array.length)];
}
/**
 * Generate random delay between requests
 */
export function getRandomDelay(minMs = 1000, maxMs = 5000) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}
/**
 * Generate human-like timing patterns
 */
export function getHumanLikeDelay() {
    // Simulate human browsing patterns with realistic delays
    const patterns = [
        // Quick browsing (30% chance)
        () => Math.floor(Math.random() * 2000) + 500,
        // Normal browsing (50% chance) 
        () => Math.floor(Math.random() * 4000) + 1500,
        // Slow browsing (20% chance)
        () => Math.floor(Math.random() * 8000) + 3000,
    ];
    const rand = Math.random();
    if (rand < 0.3)
        return patterns[0]();
    if (rand < 0.8)
        return patterns[1]();
    return patterns[2]();
}
/**
 * Create stealth request configuration for axios
 */
export function createStealthRequestConfig(config, baseConfig = {}) {
    const requestConfig = { ...baseConfig };
    if (!config.enabled) {
        return requestConfig;
    }
    // Generate headers
    let userAgent = baseConfig.headers?.['User-Agent'] || getRandomUserAgent(config.customUserAgents);
    if (config.rotateUserAgents) {
        userAgent = getRandomUserAgent(config.customUserAgents);
    }
    if (config.randomizeHeaders) {
        requestConfig.headers = generateHeaders(userAgent, baseConfig.headers);
    }
    else {
        requestConfig.headers = {
            ...baseConfig.headers,
            'User-Agent': userAgent,
        };
    }
    // Add proxy if configured
    if (config.proxyList && config.proxyList.length > 0) {
        const proxy = getRandomValue(config.proxyList);
        // Parse proxy string (format: "http://host:port" or "host:port")
        const proxyMatch = proxy.match(/^(?:(https?):\/\/)?([^:]+):(\d+)$/);
        if (proxyMatch) {
            const [, protocol = 'http', host, port] = proxyMatch;
            requestConfig.proxy = {
                protocol,
                host,
                port: parseInt(port, 10),
            };
        }
    }
    // Add additional anti-detection measures
    requestConfig.timeout = requestConfig.timeout || 30000;
    requestConfig.maxRedirects = requestConfig.maxRedirects || 5;
    // Randomize some axios settings
    if (config.randomizeHeaders) {
        // Vary timeout slightly
        const baseTimeout = requestConfig.timeout || 30000;
        requestConfig.timeout = baseTimeout + Math.floor(Math.random() * 5000);
        // Occasionally disable automatic decompression to appear more human
        if (Math.random() > 0.9) {
            requestConfig.decompress = false;
        }
    }
    return requestConfig;
}
/**
 * Calculate delay between requests with stealth timing
 */
export function calculateStealthDelay(config, baseDelay = 100) {
    if (!config.enabled || !config.randomizeTimings) {
        return baseDelay;
    }
    const minDelay = config.minDelay || 1000;
    const maxDelay = config.maxDelay || 5000;
    // Use human-like patterns
    const humanDelay = getHumanLikeDelay();
    const randomDelay = getRandomDelay(minDelay, maxDelay);
    // Combine both approaches - use the larger one
    return Math.max(humanDelay, randomDelay, baseDelay);
}
/**
 * Validate and parse proxy list
 */
export function validateProxyList(proxies) {
    return proxies.filter(proxy => {
        // Check if proxy format is valid
        const proxyMatch = proxy.match(/^(?:(https?):\/\/)?([^:]+):(\d+)$/);
        return !!proxyMatch;
    });
}
/**
 * Generate session-consistent headers (for maintaining session across requests)
 */
export class StealthSession {
    constructor(config) {
        this.config = config;
        this.userAgent = getRandomUserAgent(config.customUserAgents);
        this.headers = generateHeaders(this.userAgent);
    }
    /**
     * Get consistent headers for this session
     */
    getHeaders() {
        return { ...this.headers };
    }
    /**
     * Get the user agent for this session
     */
    getUserAgent() {
        return this.userAgent;
    }
    /**
     * Refresh session (new user agent and headers)
     */
    refresh() {
        this.userAgent = getRandomUserAgent(this.config.customUserAgents);
        this.headers = generateHeaders(this.userAgent);
    }
    /**
     * Create request config for this session
     */
    createRequestConfig(baseConfig = {}) {
        const requestConfig = { ...baseConfig };
        requestConfig.headers = {
            ...this.headers,
            ...baseConfig.headers,
        };
        return createStealthRequestConfig(this.config, requestConfig);
    }
}
/**
 * Create stealth configuration with sensible defaults
 */
export function createStealthConfig(options = {}) {
    return {
        enabled: true,
        rotateUserAgents: true,
        randomizeHeaders: true,
        randomizeTimings: true,
        minDelay: 1000,
        maxDelay: 5000,
        proxyList: [],
        customUserAgents: [],
        ...options,
    };
}
//# sourceMappingURL=stealthUtils.js.map