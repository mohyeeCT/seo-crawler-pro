/**
 * Advanced content extraction using Readability-inspired scoring algorithm
 * Reliably extracts main content from any page structure
 */
// Positive patterns that indicate main content
const POSITIVE_PATTERNS = [
    /article|content|post|entry|main|body/i,
    /product-desc|product-detail|product-info|product-content/i,
    /item-desc|item-detail|item-info|item-content/i,
    /description|details|specs|specification/i,
];
// Negative patterns that indicate boilerplate/navigation
const NEGATIVE_PATTERNS = [
    /nav|menu|sidebar|aside|widget/i,
    /footer|header|banner|toolbar/i,
    /comment|discuss|disqus|social/i,
    /ad|advertisement|promo|sponsor/i,
    /related|recommend|popular|trending/i,
];
// Minimum score threshold for content selection
const MIN_SCORE_THRESHOLD = 20;
// Minimum content length (characters)
const MIN_CONTENT_LENGTH = 100;
/**
 * Advanced content extractor using scoring algorithm
 */
export class ContentExtractor {
    constructor($) {
        this.$ = $;
    }
    /**
     * Extract main content from the page
     */
    extract() {
        // Strategy 1: Try semantic elements first (fast path)
        const semanticResult = this.trySemanticExtraction();
        if (semanticResult && semanticResult.text.length >= MIN_CONTENT_LENGTH) {
            return semanticResult;
        }
        // Strategy 2: Score-based extraction (most reliable)
        const scoringResult = this.tryScoringExtraction();
        if (scoringResult && scoringResult.text.length >= MIN_CONTENT_LENGTH) {
            return scoringResult;
        }
        // Strategy 3: Fallback to body with minimal filtering
        return this.fallbackExtraction();
    }
    /**
     * Try to extract from semantic HTML5 elements
     */
    trySemanticExtraction() {
        const semanticSelectors = [
            'main',
            '[role="main"]',
            'article',
            '[itemtype*="Product"]',
            '[itemtype*="Article"]',
        ];
        for (const selector of semanticSelectors) {
            const $element = this.$(selector).first();
            if ($element.length > 0) {
                const $clone = $element.clone();
                this.cleanElement($clone);
                const text = this.extractText($clone);
                if (text.length >= MIN_CONTENT_LENGTH) {
                    return {
                        text,
                        score: 100, // Semantic elements get perfect score
                        element: selector,
                        method: 'semantic',
                        stats: this.calculateStats($clone),
                    };
                }
            }
        }
        return null;
    }
    /**
     * Score-based content extraction (main algorithm)
     */
    tryScoringExtraction() {
        // Find all candidate container elements
        const candidates = this.findCandidates();
        if (candidates.length === 0) {
            return null;
        }
        // Score each candidate
        const scored = candidates.map(candidate => ({
            element: candidate,
            $element: this.$(candidate),
            score: this.scoreElement(candidate),
        }));
        // Sort by score (highest first)
        scored.sort((a, b) => b.score - a.score);
        // Get the winner
        const winner = scored[0];
        if (winner.score < MIN_SCORE_THRESHOLD) {
            return null;
        }
        // Clone and clean the winner
        const $content = winner.$element.clone();
        this.refineContent($content, winner.score * 0.2); // Remove children scoring below 20% of winner
        this.cleanElement($content);
        const text = this.extractText($content);
        return {
            text,
            score: winner.score,
            element: this.getElementPath(winner.element),
            method: 'scoring',
            stats: this.calculateStats($content),
        };
    }
    /**
     * Fallback extraction with minimal filtering
     */
    fallbackExtraction() {
        const $body = this.$('body').clone();
        // Remove only obvious non-content elements
        $body.find('script, style, noscript, iframe, svg').remove();
        $body.find('nav, .nav, .navbar, .navigation').remove();
        const text = this.extractText($body);
        return {
            text,
            score: 0,
            element: 'body',
            method: 'fallback',
            stats: this.calculateStats($body),
        };
    }
    /**
     * Find candidate elements for content extraction
     */
    findCandidates() {
        const candidates = [];
        const selectors = ['div', 'article', 'section', 'main'];
        for (const selector of selectors) {
            this.$(selector).each((_, element) => {
                // Only consider elements with substantial text
                const $el = this.$(element);
                const text = $el.text().trim();
                if (text.length >= 200) { // At least 200 chars to be a candidate
                    candidates.push(element);
                }
            });
        }
        return candidates;
    }
    /**
     * Score an element based on multiple factors
     */
    scoreElement(element) {
        let score = 0;
        const $element = this.$(element);
        // 1. Class/ID scoring
        score += this.scoreClassAndId(element);
        // 2. Text density scoring
        score += this.scoreTextDensity($element);
        // 3. Link density scoring (subtract for high link density)
        score -= this.scoreLinkDensity($element);
        // 4. Paragraph density scoring
        score += this.scoreParagraphDensity($element);
        // 5. Tag name bonus
        score += this.scoreTagName(element);
        return score;
    }
    /**
     * Score based on class names and IDs
     */
    scoreClassAndId(element) {
        const className = element.attribs?.class || '';
        const id = element.attribs?.id || '';
        const classId = `${className} ${id}`.toLowerCase();
        let score = 0;
        // Check positive patterns
        for (const pattern of POSITIVE_PATTERNS) {
            if (pattern.test(classId)) {
                score += 25;
            }
        }
        // Check negative patterns
        for (const pattern of NEGATIVE_PATTERNS) {
            if (pattern.test(classId)) {
                score -= 50;
            }
        }
        return score;
    }
    /**
     * Score based on text density (text length / tag count ratio)
     */
    scoreTextDensity($element) {
        const text = $element.text().trim();
        const tagCount = $element.find('*').length + 1;
        const textLength = text.length;
        if (tagCount === 0)
            return 0;
        const density = textLength / tagCount;
        // Ideal: 25-100 chars per tag
        if (density > 100)
            return 25;
        if (density > 50)
            return 20;
        if (density > 25)
            return 15;
        if (density > 10)
            return 5;
        return 0;
    }
    /**
     * Score based on link density (higher link density = likely navigation)
     */
    scoreLinkDensity($element) {
        const totalText = $element.text().length;
        if (totalText === 0)
            return 0;
        let linkText = 0;
        $element.find('a').each((_, link) => {
            linkText += this.$(link).text().length;
        });
        const density = linkText / totalText;
        // Navigation/menus have high link density - penalize them
        if (density > 0.8)
            return 50; // Strong negative
        if (density > 0.5)
            return 25;
        if (density > 0.3)
            return 10;
        return 0;
    }
    /**
     * Score based on paragraph count
     */
    scoreParagraphDensity($element) {
        const paragraphCount = $element.find('p').length;
        if (paragraphCount > 10)
            return 25;
        if (paragraphCount > 5)
            return 20;
        if (paragraphCount > 2)
            return 10;
        return 0;
    }
    /**
     * Score based on tag name
     */
    scoreTagName(element) {
        const tagName = element.name?.toLowerCase();
        switch (tagName) {
            case 'article':
                return 30;
            case 'main':
                return 25;
            case 'section':
                return 10;
            case 'div':
                return 5;
            default:
                return 0;
        }
    }
    /**
     * Refine content by removing low-scoring children
     */
    refineContent($element, threshold) {
        const $ = this.$;
        $element.find('div, section').each((_, child) => {
            const score = this.scoreElement(child);
            if (score < threshold) {
                $(child).remove();
            }
        });
    }
    /**
     * Clean element by removing non-content tags
     */
    cleanElement($element) {
        // Remove non-content elements
        $element.find('script, style, noscript, iframe, svg').remove();
    }
    /**
     * Extract text from element with normalization
     */
    extractText($element) {
        return $element.text()
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Calculate statistics for diagnostics
     */
    calculateStats($element) {
        const text = $element.text();
        const tagCount = $element.find('*').length + 1;
        const paragraphCount = $element.find('p').length;
        let linkText = 0;
        $element.find('a').each((_, link) => {
            linkText += this.$(link).text().length;
        });
        const linkDensity = text.length > 0 ? linkText / text.length : 0;
        return {
            textLength: text.length,
            tagCount,
            linkDensity,
            paragraphCount,
        };
    }
    /**
     * Get readable element path for debugging
     */
    getElementPath(element) {
        const tagName = element.name?.toLowerCase() || 'unknown';
        const className = element.attribs?.class || '';
        const id = element.attribs?.id || '';
        let path = tagName;
        if (id)
            path += `#${id}`;
        if (className)
            path += `.${className.split(' ')[0]}`;
        return path;
    }
}
//# sourceMappingURL=contentExtractor.js.map