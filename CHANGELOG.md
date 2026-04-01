# Changelog

All notable changes to the SEO Reporter will be documented in this file.

<<<<<<< HEAD
## [2.1.0] - 2025-10-22

### 🎯 Major Feature: Comprehensive SEO Scoring System

#### Intelligent Page & Site Scoring
- **8-Category Scoring Algorithm**: Weighted scoring across critical SEO dimensions:
  - Technical SEO (30%): HTTP status, security headers, HTTPS, robots directives
  - Content Quality (25%): Word count, readability, duplicate detection, thin content
  - On-Page SEO (25%): Titles, meta descriptions, headings, canonicals
  - Links & Architecture (10%): Internal linking, orphan pages, anchor text quality
  - Security (5%): HTTPS implementation, security headers, mixed content
  - Performance (5%): Load times, resource optimization
- **Site-Level Aggregation**: Overall score combining average, top performers, and technical health
- **Score Distribution**: Track pages across 6 quality tiers (Excellent 90+, Good 80-89, Fair 70-79, Needs Improvement 50-69, Poor 30-49, Critical <30)
- **Top Issues by Impact**: Identifies which issues affect the most pages with highest penalty scores

#### New CLI Options
- **`--show-score`**: Display comprehensive score summary after analysis
- **`--min-score <number>`**: Enforce minimum score threshold (exits with code 2 if not met) - perfect for CI/CD quality gates
- **Scoring Weights**: Customizable category weights via options (future enhancement)

#### Score Visualization in Reports
- **New Score Overview Tab**: Dedicated tab in HTML reports showing:
  - Overall site score with color-coded indicator
  - Category breakdown with individual scores
  - Score distribution histogram
  - Best and worst performing pages
  - Top issues by impact and affected pages
  - Site segment analysis (score by URL pattern)
- **Page-Level Scores**: Every page detail view shows its score with category breakdown
- **Score Badges**: Visual indicators throughout the UI for at-a-glance quality assessment

#### JSON API Extensions
- **`pageScores`**: Complete scoring data for every page in analysis results
- **`siteScore`**: Aggregate site-level score with distribution and insights
- **Score Data in JSON Routes**: All scores accessible via JSON API for integrations

#### Technical Implementation
- **New Module**: `src/scorer.ts` (1100+ lines) with production-grade scoring algorithms
- **Comprehensive Tests**: Full test suite in `tests/scoring.test.ts` covering edge cases
- **Performance Optimized**: Scoring adds <1 second to analysis time even for large sites
- **Type Safety**: Complete TypeScript types for all scoring data structures

### 🔧 CLI Refactoring
- **Unified Workflow**: Consolidated duplicate crawl logic into single `runCrawlWorkflow()` function
- **Better Error Messages**: Clearer validation and more informative error messages
- **Code Quality**: Reduced CLI codebase from ~800 lines to ~350 lines (-56%)

### 🐛 Bug Fixes
- Fixed TypeScript compilation errors in analyzer weight normalization
- Fixed unused parameter warnings in scorer

### 📚 Use Cases
- **Quality Gates**: Use `--min-score` in CI/CD to enforce SEO standards
- **Progress Tracking**: Monitor score improvements over time
- **Priority Setting**: Focus on issues with highest impact scores
- **Client Reporting**: Professional score reports for stakeholders
- **Team Accountability**: Clear metrics for SEO health

## [2.0.0] - 2025-10-17

### 💥 Breaking Changes
- Replaced Cheerio-based parsing with a DOM-lite stack (htmlparser2 + css-select + domutils)
- Removed dependency on `cheerio` and `@types/cheerio`
- Minor selector/DOM nuance differences may exist vs Cheerio (edge cases in malformed HTML and `.not()`-style patterns). Public CLI/API remains the same, but custom integrations expecting Cheerio objects are no longer supported.

### 🚀 Performance & Reliability
- Faster metadata parsing with lower memory overhead
- Maintains feature parity: titles/descriptions, canonicals/robots, headings, links, images, scripts, content metrics, ContentExtractor, HTML validation, security metrics, pagination, hreflang, schema validation, sitemap analysis
- End-to-end tested on example.com and dezaan.com (1,650 pages) with matching outputs

### 🔧 Migration Guide
- No changes for CLI usage
- If you built custom code around internal Cheerio objects, use the returned PageMetadata structures or rewrite DOM utilities against the new wrapper in `src/utils/domLite.ts`

## [1.3.0] - 2025-10-20

### 🔧 CLI Structure Improvements

#### Command-Based Architecture
- **Serve Command Independence**: `seo-reporter serve` now works without requiring URL option
- **Backward Compatibility**: Legacy `seo-reporter --url https://example.com` format still supported
- **Explicit Commands**: New `seo-reporter crawl --url https://example.com` format for clarity
- **Help System**: Improved command help with clear usage examples

### ✨ Major UI/UX Improvements
#### Issues Tab: Filters, Sorting, Totals, and Views
- Fixed broken filters on the Issues tab (search box now filters data correctly across chunks)
- Added column sorting for Issues (including severity-aware ordering)
- Default sort for Issues now shows highest severity first (High → Medium → Low)
- Added dynamic Issue Type dropdown (e.g., Missing Title, Images Without Alt). Options populate from actual data.
- Added live filtered totals: shows counts for current filters (High/Medium/Low) and selected issue type
- New sub-tabs: "All" and "By Type". The By Type view groups issues by category and shows totals; clicking a type drills into the All view with that filter applied

#### Tooltips (i) Consistency
- Fixed non-working (i) info icons across the report
- Implemented robust tooltip overlay that follows the cursor and works for chunked rows

#### UI Fixes
- Fixed tab switching logic so the **API** tab reliably renders
- Updated tab buttons to use `data-tab` attributes and resilient activation logic
- Fixed broken labels in Overview charts (escaped `<` characters caused `< /span>` artifacts)
- Pagination now displays correct total pages from the first page (no more 1/5 until page 5). Uses dataset manifest totals when unfiltered
 - Navigation reorganized: added **Content** dropdown (Headings & Images, Links, Scripts), moved **Performance** next to All Pages, and moved **API** to end of the navbar
 - Issues defaults updated: show **By Type** sub-tab first; issues list still default-sorts by severity (high→low)


#### Actionable Tooltips in Issues Tab
- **Info Icons with Guidance**: Every issue now shows an (i) icon with hover tooltip
- **25+ Fix Recommendations**: Specific, actionable advice for:
  - Title length optimization (too long/short)
  - Meta description improvements
  - H1 tag best practices
  - Content quality enhancements
  - Security header fixes
  - URL quality improvements
  - Readability optimization
  - And many more...
- **Consistent UX**: Matches page-viewer.html tooltip system
- **No Documentation Needed**: Users get immediate guidance without searching docs

#### Page Viewer Stats Improvements
- Split the single issues summary into **separate High/Medium/Low cards** on `page-viewer.html`
- Clearer at-a-glance risk visualization per page

#### Clickable Site Structure
- Items in the Site Structure tab now link directly to `page-viewer.html?url=...`
- Non-page nodes open their full URL in a new tab

#### New API Tab
- Added an **API** tab to `index.html` listing JSON endpoints and usage examples
- Includes curl and fetch examples, and guidance for `json/url-index.json`

#### Mobile Responsive Design
- **Universal Mobile Support**: All report pages now fully responsive
- **Three Breakpoints**:
  - Desktop: > 768px - Full layout
  - Tablet: 481-768px - Optimized layout
  - Mobile: ≤ 480px - Compact 2-column layout
- **Touch-Friendly Interface**:
  - 44px minimum tap targets (iOS Human Interface Guidelines)
  - Proper spacing to prevent mis-taps
  - Smooth momentum scrolling on iOS
- **Summary Report (summary.hbs)**:
  - Adaptive stat grid (2 columns on mobile)
  - Touch-friendly tabs with horizontal scroll
  - Stacked controls and full-width search
  - Visual scroll indicator (⇄) on tables
  - ~175 lines of responsive CSS
- **Page Viewer (page-viewer.html)**:
  - Single-column layout on mobile
  - Stats grid adapts from 7 to 2 columns
  - Optimized typography (min 11px fonts)
  - ~120 lines of responsive CSS
- **Page Template (page.hbs)**:
  - Score dashboard: 8 cols → 2 cols on mobile
  - Meta info stacks vertically
  - All content remains accessible
  - ~155 lines of responsive CSS
- **Zero Breaking Changes**: Desktop layout unchanged, all functionality preserved

#### Built-in Static File Server
- **Zero Dependencies**: Uses Node.js built-in modules only (http, fs, path)
- **Package Size Impact**: +0 KB (no new dependencies added)
- **New Command**: `seo-reporter serve [directory] [options]`
  - Serves reports on http://localhost:8080 by default
  - Custom port: `--port 3000`
  - Directory defaults to `./seo-report`
- **npm Script**: `pnpm serve` for quick access
- **Features**:
  - 12+ MIME types supported
  - Path traversal protection
  - Automatic index.html routing
  - Port conflict detection
  - Graceful shutdown (Ctrl+C)
  - Compiled size: ~4.7 KB
- **Benefits**:
  - No CORS issues (vs file:// protocol)
  - JSON loading works properly
  - All report features functional
  - Works on macOS, Linux, Windows
  - Instant startup (~50ms)
  - Professional development experience
- **Alternative to**:
  - npx http-server (no internet required)
  - Python http.server (already have Node.js)
  - Opening files directly (avoids security restrictions)

### 📚 Documentation
- **PRODUCTION_READY.md** (8.1 KB): Complete production readiness checklist, testing results, deployment guide
- **CHANGELOG_MOBILE_TOOLTIPS.md** (6.8 KB): Technical changelog with code examples and line numbers
- **SERVER_GUIDE.md** (336 lines): Comprehensive server usage guide with troubleshooting and CI/CD examples
- **SERVER_IMPLEMENTATION.md** (306 lines): Technical implementation details and architecture notes
- **README.md**: Updated with API tab info, clickable Site Structure note, and server usage examples

### 🔧 Technical Details
- **Added**: `src/server.ts` - Static file server implementation
- **Modified**: `templates/report.js` - Added getSuggestion() function and tooltip rendering
- **Modified**: `templates/summary.hbs` - Added 175 lines responsive CSS
- **Modified**: `templates/page-viewer.html` - Added 120 lines responsive CSS
- **Modified**: `templates/page.hbs` - Added 155 lines responsive CSS
- **Modified**: `src/cli.ts` - Added serve subcommand integration
- **Modified**: `package.json` - Added serve script

### ✅ Production Ready
All ship-blocking issues resolved:
- ✅ Tooltips provide actionable guidance
- ✅ Mobile responsive on all devices
- ✅ Simple server for viewing reports
- ✅ Zero breaking changes
- ✅ Comprehensive documentation

### 🐛 Bug Fixes: Redirect Handling and Link Resolution
- Prevent analysis and crawling after cross-domain redirects. The tool now records the redirect chain but does not fetch or follow links on the destination domain.
- After same-domain redirects, links are resolved against the final URL so internal/external classification and subsequent crawling are accurate.
- Redirect destinations are normalized to absolute URLs in `redirectChain` for consistent reporting.

### 🛠️ 404 Referrer Mapping Improvement
- Normalized URLs are now used when mapping referrers to 404 pages. This prevents trailing-slash and minor formatting differences from hiding valid internal referrers (e.g., `/path` vs `/path/`).
- Referrers are also de-duplicated.
- Affects: `json/404-pages.json` and the 404 Pages tab referrer counts.


## [1.2.0] - 2025-10-16

### ✨ New Features

#### JSON API Routes
- **Complete JSON API**: All SEO data now accessible via JSON files for programmatic access
- **Individual Page Routes**: Each page's data available at `json/pages/{filename}.json` and `json/issues/{filename}.json`
- **Aggregate Endpoints**: Summary data available in JSON format:
  - `json/all-pages.json` - All pages summary with key metrics
  - `json/all-issues.json` - All issues across all pages
  - `json/issues-summary.json` - Issues statistics by severity and type
  - `json/links.json` - Internal and external links
  - `json/images.json` - All images with alt text status
  - `json/headings.json` - All headings with levels
  - `json/performance.json` - Performance metrics for all pages
  - `json/external-scripts.json` - External JavaScript usage
  - `json/404-pages.json` - 404 pages with referrers
  - `json/sitemap-info.json` - Sitemap analysis data
  - `json/site-structure.json` - Site structure tree
  - `json/url-index.json` - URL to filename mapping
- **Dynamic Page Viewer**: New `page-viewer.html` loads page data dynamically from JSON
- **Scalable Architecture**: No more generating thousands of HTML files for large sites
- **API-First Design**: Perfect for integrations, custom dashboards, or CI/CD pipelines

### 🔧 Improvements
- Dashboard links now point to dynamic page viewer instead of static HTML pages
- Reduced file generation overhead for large sites
- Individual page HTML generation now optional (disabled by default)
- Better separation between presentation layer (HTML) and data layer (JSON)
=======
---

## [1.1.9] - 2025-10-17

### ✨ New Features

#### Stealth Mode for Advanced Web Scraping 🥷
- **Comprehensive stealth crawling capabilities** to bypass basic bot detection
- **User Agent Rotation**: Realistic user agent strings from Chrome, Firefox, Safari, Edge on Windows, macOS, and Linux
- **Header Randomization**: Dynamic browser headers with realistic patterns and sec-ch-ua headers for Chrome
- **Timing Randomization**: Human-like delays between requests (1-8 seconds with pattern variation)
- **Proxy Support**: Rotate through multiple proxy servers with automatic failover
- **Session Management**: Maintain consistent headers across requests for realistic browsing simulation

**Command Line Options:**
```bash
seo-reporter --url https://example.com \
  --stealth \
  --stealth-user-agents "Custom Agent 1,Custom Agent 2" \
  --stealth-min-delay 2000 \
  --stealth-max-delay 8000 \
  --stealth-proxies "proxy1.example.com:8080,proxy2.example.com:3128"
```

#### Advanced Link Validation System 🔗
- **Redirect Chain Following**: Tracks full redirect chains to final destinations
- **External Redirect Detection**: Identifies internal links that redirect to external domains
- **Link Validation Results**: Provides reachability status, final URLs, and error details
- **Batch Link Validation**: Concurrent validation with configurable limits
- **Common Redirect Patterns**: Pre-identifies links likely to redirect externally (privacy policies, legal pages)

#### Enhanced Link Analysis
- **Final URL Tracking**: Shows where redirected links ultimately lead
- **External Redirect Flagging**: Identifies internal links that redirect to external domains
- **Improved Link Classification**: More accurate internal/external categorization after redirect resolution

### 🔧 Technical Enhancements

**New Utilities:**
- `linkValidator.ts` - Comprehensive link validation with redirect tracking
- `stealthUtils.ts` - Complete stealth crawling toolkit with browser simulation

**Enhanced Core Modules:**
- Updated crawler to support stealth sessions and advanced timing
- Enhanced parser with better link handling and validation
- Improved content analyzer with redirect-aware link processing
- Extended type definitions for stealth configuration and link validation

**Stealth Features:**
- 20+ realistic user agents across major browsers and platforms
- Dynamic header generation with browser-specific patterns
- Human-like timing with quick/normal/slow browsing simulation
- Chrome sec-ch-ua header generation for enhanced legitimacy
- Proxy rotation with automatic parsing and validation
- Session consistency for maintaining realistic browsing patterns

**Performance Optimizations:**
- Intelligent delay calculation combining base delays with stealth timing
- Concurrent link validation with rate limiting
- Efficient redirect chain tracking with minimal overhead

### 🎯 Use Cases

**Stealth Mode Benefits:**
- Access sites with basic bot detection
- Appear as legitimate browser traffic
- Reduce rate limiting and IP blocking
- Simulate realistic user browsing patterns
- Test sites behind CloudFlare and similar protection

**Link Validation Benefits:**
- Identify redirect chains that affect SEO
- Find internal links that leak to external domains
- Validate link destinations without manual checking
- Track link integrity across the entire site
- Detect potentially problematic redirect patterns

### 🔄 Configuration

**Stealth Configuration:**
```typescript
stealth: {
  enabled: true,
  rotateUserAgents: true,
  randomizeHeaders: true, 
  randomizeTimings: true,
  minDelay: 1000,
  maxDelay: 5000,
  customUserAgents: ['Custom Agent 1', 'Custom Agent 2'],
  proxyList: ['proxy1.com:8080', 'http://proxy2.com:3128']
}
```

**Link Validation Integration:**
- Automatic validation of suspicious redirect patterns
- Pre-validation of common external redirect links
- Integration with existing link analysis pipeline
- Configurable concurrency and timeout settings

## [1.1.6] - 2025-10-16

### ✨ New Features

#### Automatic Rust Setup
- Added `pnpm setup:rust` command for automatic Rust installation
- Cross-platform support: Windows, macOS, and Linux
- Downloads and installs rustup automatically
- Verifies installation and provides next steps
- Eliminates manual Rust installation complexity

#### Sitemap Crawl Modes
- Added `--crawl-mode` flag with three options:
  - `crawl` - Follow links only (traditional crawling)
  - `sitemap` - Crawl only URLs found in sitemap(s)
  - `both` - Crawl sitemap URLs + follow links (default)
- Automatically fetches and integrates sitemap URLs into crawl queue
- Deduplicates URLs between sitemap and link-based discovery
- Custom sitemap URL support with `--sitemap-url` flag

#### Indexability Tracking
- Comprehensive indexability analysis for every page
- Tracks multiple factors that prevent indexing:
  - Non-200 HTTP status codes (404, 500, etc.)
  - `noindex` in meta robots tag
  - `noindex` in X-Robots-Tag HTTP header
  - Canonical URL pointing to different page
- Detailed reasons displayed in:
  - Individual page reports (dedicated Indexability section)
  - Issues tab with high severity
  - Sitemap analysis (non-indexable URLs in sitemap)

#### Unified Issue Severity Filter
- Replaced three separate severity tables (High/Medium/Low) with single unified Issues table
- Added dropdown filter to show: All Severities, High Only, Medium Only, or Low Only
- Improved performance by loading issues as single dataset
- Cleaner, more intuitive UI for issue management

### 🔧 Improvements
- Issues tab now shows severity as a dedicated column
- Sitemap "Non-Indexable URLs" table now shows specific reasons why each URL isn't indexable
- Configuration display now shows selected crawl mode
- Better error handling for sitemap fetching failures
- **Build system improvements**: Updated build scripts to automatically source Rust environment (`$HOME/.cargo/env`) for reliable Rust module compilation
- **Enhanced build commands**: Added `build:rust-only` and `build:ts-only` scripts for granular control

### 🐛 Bug Fixes: Crawler 404s from Bare Domain Links

**Fixed excessive 404s caused by following bare domain links as relative URLs**

- Problem: Links like `href="facebook.com"` were resolved as `https://example.com/facebook.com`, treated as internal, and crawled → 404s
- Fixes:
  - Added `isBareExternalDomain()` utility to detect bare domain patterns
  - Crawler now skips queuing bare domain links (prevents false internal crawls)
  - Parser normalizes these to `https://<domain>` for reporting and marks them as external
  - Adds medium-severity issue: "external link(s) missing protocol (e.g., \"https://\")"
- Result: ✅ No more false 404s from bare domain links; clear issue reported for remediation

## [1.1.9] - 2025-10-17
Implemented chunked client-side rendering for large report tables to drastically improve load times on 500–10,000+ page sites.

#### Highlights
- Tables now load progressively from JSONP chunk files in `seo-report/data/` (works via `file://`).
- Client-side pagination with page-size selector (25/50/100/250/500).
- Sorting/filtering triggers background loading of remaining chunks for accurate results.
- Small sites remain inline-rendered; large sites display instantly and stream in rows.

#### Affected
- `templates/summary.hbs` (table skeletons, controls, hooks)
- `templates/report.js` (client runtime, chunk loader, pagination, sort/filter)
- `src/reporter.ts` (chunk writer, lightweight row datasets, manifest)

#### Notes
- This is a non-breaking UX improvement. Reports remain a single folder; `index.html` still opens offline.
- For extremely large sites, initial view renders fast with rows streaming as chunks load.

### 🐛 Bug Fixes: Report Initialization & External Scripts

**Fixed Critical Report Loading Issues:**

1. **404 Pages Tab Not Loading**
   - **Problem**: Table initialized but `initReport()` never called, causing empty tables
   - **Problem**: Invalid CSS ID `404-pages-table` (starts with number)
   - **Problem**: JavaScript hoisting error with `renderers` object
   - **Fix**: Added `DOMContentLoaded` event listener to call `initReport()`
   - **Fix**: Renamed table ID to `pages404-table` throughout codebase
   - **Fix**: Used JavaScript getters for lazy evaluation of renderer references
   - **Result**: ✅ All 404 pages now display correctly with referrer tracking

2. **Scripts Tab Not Showing Scripts**
   - **Problem**: Showing "0 scripts" even though scripts exist in HTML
   - **Root Cause**: Function only returned scripts from different domains (`isExternal` filter)
   - **Root Cause**: Tab name "External Scripts" was misleading (implied only third-party)
   - **Fix**: Changed `extractExternalScripts()` to return ALL scripts (both same-domain and third-party)
   - **Fix**: Added `isExternal` field to distinguish same-domain vs third-party
   - **Fix**: Renamed tab from "External Scripts" to "Scripts" for clarity
   - **Fix**: Added "Source" column with badge (Same-Domain/Third-Party)
   - **Fix**: Sort third-party scripts first, then by usage count
   - **Fix**: Added informative empty state for sites with no script tags
   - **Result**: ✅ Now shows 24 scripts for dezaan.com (webpack bundles, framework, app.js, etc.)

3. **Performance Tab Showing All Zeros**
   - **Problem**: Overview and Performance tab charts all showing "0" for stats
   - **Root Cause**: Handlebars helpers (`countFast`, `countModerate`, etc.) expected `pages` array
   - **Root Cause**: With chunked loading, `pages` array no longer passed to template context
   - **Fix**: Pre-calculate statistics in reporter (fastPages, moderatePages, slowPages, goodContentPages, thinContentPages)
   - **Fix**: Pass computed values directly to template instead of using helpers
   - **Result**: ✅ Performance metrics now display correctly (984 fast, 16 moderate, 0 slow out of 1000 pages)

4. **Missing Import Extension**
   - **Problem**: `import { createSpinner } from './utils/spinner'` missing `.js` extension
   - **Fix**: Updated to `'./utils/spinner.js'` for proper ESM resolution
   - **Result**: ✅ Build and runtime work correctly

#### Files Modified
- `templates/summary.hbs` - Fixed 404 table ID, added initReport() call, renamed tab to "Scripts", added Source column, updated performance charts to use direct values
- `templates/report.js` - Fixed renderer hoisting, updated table ID references, moved helper functions
- `src/reporter.ts` - Added performance/content statistics calculation (fastPages, moderatePages, slowPages, goodContentPages, thinContentPages)
- `src/parser.ts` - Changed extractExternalScripts() to return ALL scripts with isExternal flag
- `src/analyzer.ts` - Updated aggregateExternalScripts() to handle isExternal field and sort by it
- `src/types.ts` - Added isExternal field to ExternalScript interface
- `src/cli.ts` - Fixed spinner import extension
- `README.md` - Documented JavaScript rendering limitation and impact on script detection

#### Tested With
- **dezaan.com** (433 pages, then expanded to 1000 pages, React/Gatsby app)
- ✅ All tabs verified working: Overview, All Pages, Site Structure, Links, Content, Performance, Scripts, Sitemap, 404 Pages, Issues
- ✅ Scripts tab showing 24 scripts (webpack bundles, framework files, app.js, polyfill)
- ✅ All scripts correctly marked as "Same-Domain" with usage counts
- ✅ Performance tab now showing correct statistics (984 fast, 16 moderate pages out of 1000)
- ✅ Overview charts displaying accurate response time and content quality distributions
- ✅ Individual page reports working correctly
- ✅ Chunked data loading verified (larger dataset with 1000 pages)

#### Important Note
This crawler analyzes **static HTML only** and detects scripts present in `<script src="...">` tags. For client-side rendered apps (React/Vue/Angular/Gatsby), many scripts are loaded dynamically by JavaScript after page load. These runtime-loaded scripts (e.g., Google Tag Manager, analytics) are **not visible to static HTML crawlers** like this tool or Screaming Frog in default mode. The Scripts tab will show a notice when no scripts are found in the static HTML.

### 🐛 Critical Bug Fix: URL Case Sensitivity

**Fixed a critical bug where URL paths were being incorrectly lowercased**

#### The Problem

The `normalizeUrlForComparison()` function was lowercasing entire URLs, including the path component. This caused URLs like `/en-US/page` to be treated as identical to `/en-us/page`, which is incorrect according to RFC 3986 (URL paths are case-sensitive).

**Impact:**
- Sitemap comparisons incorrectly treated case-different URLs as identical
- Could miss actual duplicate content when paths differed only in case
- Affected all sitemap analysis features

#### The Fix

Updated the normalization to only lowercase the hostname (which is case-insensitive), while preserving the original case of the path:

```typescript
// Before (incorrect):
return urlObj.toString().toLowerCase(); // Lowercases entire URL

// After (correct):
return urlObj.toString(); // Hostname already lowercased on line 47
```

**Benefits:**
- ✅ URLs now maintain their original case in reports
- ✅ Sitemap comparison correctly distinguishes `/en-US` from `/en-us`
- ✅ Compliant with RFC 3986 URL standards
- ✅ More accurate duplicate detection

### ✨ New Feature: 404 Pages Tracking with Referrers

**Added comprehensive 404 page tracking with referrer information**

#### What's New

1. **404 Count in Overview**: New stat card showing total 404 pages in the overview section
2. **Dedicated 404 Pages Tab**: A new tab specifically for viewing all 404 pages
3. **Referrer Tracking**: See which pages link to each 404 URL

#### The 404 Pages Tab

The new tab provides:
- **Complete 404 List**: All pages that returned a 404 status
- **Referrer Count**: Badge showing how many pages link to each 404
- **Referring Pages**: Expandable list of pages that link to each broken URL
- **Search & Sort**: Filter and sort 404 pages for easier analysis
- **Direct Links**: Click to visit the 404 URL or any referring page

#### Why This Matters

Finding broken links is only half the solution—you need to know where they're coming from to fix them effectively. The referrer tracking feature tells you:
- Which pages need to be updated to remove broken links
- Whether a 404 is linked from one page or dozens
- If any 404s have no internal referrers (possibly external links only)

#### Example Use Case

```
404 URL: https://example.com/old-product
Referrers: 5 pages
Referring Pages:
  - https://example.com/products
  - https://example.com/category/electronics
  - https://example.com/blog/post-1
  - https://example.com/blog/post-2
  - https://example.com/footer (appears on all pages)
```

Now you know exactly which 5 pages to update when you redirect or remove the old product page!

**Files Modified:**
- `src/utils/urlUtils.ts` - Fixed URL case sensitivity
- `src/analyzer.ts` - Added 404 referrer tracking logic
- `src/reporter.ts` - Pass 404 data to template
- `src/types.ts` - Added pages404 field to AnalysisResult
- `templates/summary.hbs` - Added 404 stat card and dedicated tab
- `README.md` - Documented new 404 tracking features

## [1.1.4] - 2025-10-16

### ✨ Enhanced User Experience: Analysis Progress & Rust Warning

**Two new features improve visibility and transparency during SEO analysis**

#### 1. Rust Engine Warning

When the Rust native module is not available, the tool now displays a clear warning message:

```
⚠️  Rust native module not available - using TypeScript fallback for near-duplicate detection
   Note: Near-duplicate detection will be slower. Run `npm rebuild` to build the Rust module.
```

**Benefits:**
- Users immediately know if they're missing out on the faster Rust implementation
- Clear, actionable instructions on how to enable the optimized code
- Reduces confusion about performance differences

**Technical Details:**
- Check runs after parsing completes, before analysis begins
- Uses `isUsingNativeModule()` to detect Rust module availability
- Only appears when Rust module fails to load (silent when working)

#### 2. Detailed Analysis Progress

The analysis phase now shows real-time progress with page counts, matching the detail level of crawling and parsing:

**Before:**
```
⠹ Analyzing... Per-page analysis
```

**After:**
```
⠹ Analyzing... Per-page analysis (25/100)
⠸ Analyzing... Per-page analysis (50/100)
⠼ Analyzing... Per-page analysis (100/100)
```

**Benefits:**
- Better visibility into analysis progress, especially for large sites
- Reduces user anxiety during long-running operations
- Consistent UX across all phases (crawling, parsing, analysis)
- Better time estimation for remaining work

**Technical Details:**
- Progress updates throttled to ~20 callbacks (approximately every 5% for large sites)
- Shows exact page counts during per-page analysis phase
- Other analysis steps continue to show step names
- Minimal performance overhead (<1ms per 100 pages)

### Added
- Warning message when Rust native module is unavailable
- Real-time progress counters for analysis phase showing `(current/total)` pages
- Enhanced progress callback signature with optional `current` and `total` parameters

### Changed
- `analyzePages()` function signature updated: `onProgress?: (step: string, current?: number, total?: number) => void`
- CLI progress handler enhanced to display page counts when available

### Developer Notes
- Changes are backward compatible (progress parameters are optional)
- No breaking changes to existing code
- Progress updates use smart throttling to avoid console spam

## [1.1.3] - 2025-10-16

### ✨ New Feature: Auto-.gitignore

**Tool automatically adds output directory to .gitignore**

When generating reports, the SEO Reporter now automatically adds the output directory to your project's `.gitignore` file. This prevents accidentally committing large report files to version control.

#### How it Works
- After generating reports, checks for `.gitignore` in current working directory
- If `.gitignore` exists, adds output directory if not already present
- If `.gitignore` doesn't exist, creates one with the output directory
- Handles multiple output directories correctly (won't duplicate entries)
- Fails silently if not in a git repository (non-critical operation)

#### Example
```bash
# Run the tool
seo-reporter --url https://example.com --output my-reports

# Automatically creates/updates .gitignore:
# SEO Reporter output
my-reports/
```

### Added
- Auto-.gitignore functionality in CLI after report generation

## [1.1.2] - 2025-10-16

### ✨ Major Enhancement: Readability-Inspired Content Extraction

**Replaced selector-based extraction with intelligent scoring algorithm**

Completely rewrote content extraction using a **Readability-inspired algorithm** (based on Mozilla Firefox Reader Mode) that intelligently identifies main content on any page structure.

#### New ContentExtractor Features

**3-Strategy Approach:**
1. **Semantic HTML5 First**: Checks for `<main>`, `<article>`, `[role="main"]`, Schema.org markup
2. **Scoring Algorithm**: Evaluates all container elements using multiple signals:
   - **Class/ID patterns**: +25 for content indicators, -50 for navigation/ads
   - **Text density**: Rewards 25-100 chars per tag ratio
   - **Link density**: Penalizes high link density (navigation detection)
   - **Paragraph count**: Rewards multiple paragraphs
   - **Tag bonus**: `<article>` +30, `<main>` +25, `<section>` +10
3. **Fallback**: Minimal filtering if strategies 1-2 fail

**Benefits:**
- ✅ **Algorithm-based**: Not dependent on specific CSS classes/selectors
- ✅ **Self-adapting**: Works on blogs, e-commerce, SaaS, news sites, etc.
- ✅ **E-commerce friendly**: Product descriptions naturally score high
- ✅ **Battle-tested logic**: Based on Mozilla Readability (millions of users)
- ✅ **Refinement**: Recursively removes low-scoring children within winner
- ✅ **Diagnostics**: Returns extraction stats for debugging

#### Implementation Details

**New File:** `src/utils/contentExtractor.ts`
- `ContentExtractor` class with comprehensive scoring system
- `ExtractionResult` interface with diagnostics
- Configurable thresholds and patterns

**Integration:** `src/parser.ts`
- Simplified `extractBodyText()` to use ContentExtractor
- Maintains same interface, better results

#### Expected Improvements

Compared to v1.1.1 selector-based approach:
- **More reliable**: Algorithm adapts to any site structure
- **Fewer false positives**: Better distinguishes unique vs duplicate content
- **Better coverage**: Works on sites without semantic HTML5 markup
- **Debuggable**: Can see why content was/wasn't selected (score, method, stats)
- **Future-proof**: Not tied to specific CSS conventions

### Changed
- Complete rewrite of content extraction from selector-based to scoring-based algorithm
- Parser now uses `ContentExtractor` class for reliable main content identification

## [1.1.1] - 2025-10-16

### 🐛 Critical Bug Fixes

**Fixed Duplicate Content Detection System**

The duplicate content detection system had a critical bug causing false positives, especially on e-commerce sites:

#### Problem
- **1505 exact duplicates** but only **1465 near-duplicates** (mathematically impossible - exact should be subset of near)
- Over-aggressive boilerplate removal stripped unique product content from e-commerce pages
- Inconsistent filtering between exact and near-duplicate detection
- Empty/minimal content pages all hashed to same value → massive false positives

#### Root Cause
1. `extractBodyText()` removed ALL `<header>`, `<footer>`, `<aside>` elements - too aggressive for product pages
2. After boilerplate removal, many pages left with no content
3. Exact duplicate check analyzed ALL pages, but near-duplicate check only pages with >50 words
4. Empty strings all hashed identically

#### Fixes Applied

**Smarter Content Extraction** (`src/parser.ts`)
- **Strategy 1:** Prioritize semantic content areas (`<main>`, `<article>`, `[role="main"]`)
- **Strategy 2:** Remove only site-level boilerplate (`.site-header`, `.site-nav`, `.global-footer`)
- **Strategy 3:** Fallback to minimal filtering if content too short (<100 chars)
- Keep product-specific elements: `.product-*`, `[itemtype*="Product"]`, `.item-*`
- Keep page-level headers (often contain unique product titles/breadcrumbs)
- E-commerce friendly: preserves product descriptions, specs, prices

**Consistent Filtering** (`src/contentAnalyzer.ts`)
- Both exact AND near-duplicate detection now use same criteria:
  - Must have `bodyText` present
  - Must have >100 characters of content
  - Must have >50 words
  - Must be status 200
- Prevents false positives from empty/minimal content pages

#### Expected Results
- ✅ Exact duplicates ≤ near-duplicates (mathematically correct)
- ✅ E-commerce product pages with unique descriptions not flagged as duplicates
- ✅ Category/listing pages with different products properly distinguished
- ✅ Empty/minimal content pages excluded from analysis (no false positives)

### Changed
- Content extraction now prioritizes main content areas over aggressive boilerplate removal
- Duplicate detection applies consistent filtering to avoid empty content false positives

## [1.1.0] - 2025-10-16

### 🚀 Major Performance Update: Rust + Worker Threads

This release delivers **~5x overall speedup** with massive performance improvements across all analysis stages.

#### Performance Improvements

**Overall Speed:**
- 1292 pages: **6-7 minutes → 80 seconds** (~5x faster)
- 5000 pages: **~30 minutes → ~5 minutes** (~6x faster)

**Breakdown:**
- **Near-duplicate detection:** 5+ minutes → 0.3s (**~1000x faster** with Rust + LSH)
- **HTML parsing:** 47s → 21s (**2.2x faster** with worker threads)
- **Text metrics:** **~40% faster** with sampling and optimizations

#### New Features

**🦀 Rust Native Module**
- Locality-Sensitive Hashing (LSH) for O(n) near-duplicate detection
- MinHash signatures with 128 hashes per page
- 16 bands × 8 rows for ~95% accuracy
- Parallel processing using rayon
- Pre-built binaries for macOS, Linux, Windows
- Graceful fallback to TypeScript if unavailable

**⚙️ Worker Thread Parallelization**
- Parallel HTML parsing across all CPU cores
- Automatic core detection and work distribution
- 2-8x faster parsing (depends on CPU cores)

**🎨 Clean Progress UI**
- Dynamic progress bars (no console spam)
- Real-time status indicators: 🟢🟡🔴
- Step-by-step analysis progress
- Timing information for each stage

**📊 Optimized Text Metrics**
- Sampling for large texts (>1000 words)
- Pre-compiled regex patterns
- Character code optimizations
- 10x faster readability calculations

#### Technical Details

**New Files:**
- `native/` - Rust native module with MinHash, LSH, similarity detection
- `src/parallelParser.ts` - Worker thread orchestration
- `src/parser.worker.ts` - HTML parsing worker
- `docs/PERFORMANCE_BENCHMARKS.md` - Detailed benchmarks
- `PERFORMANCE_OPTIMIZATION.md` - Implementation guide
- `OPTIMIZATION_COMPLETE.md` - Final results summary

**Modified Files:**
- `src/cli.ts` - Progress callbacks and parallel parsing
- `src/crawler.ts` - Progress tracking, cleaner output
- `src/analyzer.ts` - Progress indicators
- `src/contentAnalyzer.ts` - Rust module integration with fallback
- `src/utils/textMetrics.ts` - Optimized calculations
- `package.json` - Build scripts, dependencies, napi config
- `README.md` - Performance section added

**Dependencies Added:**
- `@napi-rs/cli` (dev) - Rust native module builder

**Build Process:**
```bash
pnpm build:rust  # Compiles Rust module
pnpm build       # Builds Rust + TypeScript
```

#### Supported Platforms

Pre-built native binaries included for:
- macOS (Intel x64 & Apple Silicon ARM64)
- Linux (x64 & ARM64, glibc & musl)
- Windows (x64)

Unsupported platforms automatically fall back to TypeScript (slower but functional).

#### Benchmarks

See `docs/PERFORMANCE_BENCHMARKS.md` for detailed performance analysis.

**Key Results (1292 pages):**
- Crawling: 49s (network-bound)
- Parsing: 21s (8 worker threads)
- Analysis: 0.3s (Rust + LSH)
- **Total: ~80 seconds**

#### Breaking Changes

None - fully backward compatible.

#### Migration Guide

No migration needed. Update and enjoy the performance gains:
```bash
pnpm update seo-reporter
npx seo-reporter --url https://example.com
```

---

### New Analysis Categories

**Security Analysis 🔒**
- HTTP vs HTTPS detection
- Mixed content detection (HTTP resources on HTTPS pages)
- Insecure form actions
- Security headers analysis (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Protocol-relative URLs detection
- Missing security headers warnings

**URL Quality Analysis 🔗**
- Multiple consecutive slashes
- Spaces in URLs
- Non-ASCII characters
- Uppercase characters in paths
- Repetitive path segments
- URL length validation (>2083 chars warning)
- Query parameter detection
- Tracking parameter identification
- Internal search URL detection
- Fragment-only URLs

**Advanced Content Analysis 📄**
- **Duplicate Detection:**
  - Exact duplicates using SHA-256 hashing
  - Near duplicates (>90% similarity) using MinHash algorithm
  - Duplicate H1/H2 detection across pages
- **Content Quality:**
  - Lorem ipsum detection
  - Soft 404 detection (200 status with "not found" content)
  - Readability metrics (Flesch-Kincaid Grade, Reading Ease, ARI)
  - Poor readability warnings (>12th grade level)
  - Content-to-code ratio calculation
  - Thin content detection (<300 words)

**Enhanced Link Analysis 🔗**
- Orphan page detection (no internal inlinks)
- Dead-end pages (no outlinks)
- Weak anchor text analysis ("click here", empty, too short)
- Localhost/127.0.0.1 link detection
- High outlink count warnings (>100 internal, >50 external)
- Inlink count per page
- Internal nofollow detection

**HTML Structure Validation ⚙️**
- Missing/multiple `<head>` or `<body>` tags
- Element positioning validation (tags outside `<head>`)
- Document order checking
- Very large HTML warnings (>1MB)
- Excessive DOM depth detection (>30 levels)
- Invalid elements in `<head>`

### Enhanced Existing Features

**Metadata Analysis:**
- Pixel width calculations for titles (>600px warning) and descriptions (>990px warning)
- Title identical to H1 detection
- Multiple tags outside `<head>` detection
- Enhanced canonical validation (relative URLs, fragments, invalid attributes)

**Heading Analysis:**
- Duplicate heading detection across pages
- Broken hierarchy detection
- Overly long headings (>70 chars)
- Empty heading detection

**Pagination:**
- rel="next"/rel="prev" validation
- Multiple pagination link detection
- Sequence error identification

**Hreflang:**
- Self-reference validation
- Language/region code validation

### New Utility Modules

- `textMetrics.ts` - Pixel width calculation, readability formulas, syllable counting
- `securityUtils.ts` - Security header parsing, validation, scoring
- `urlQualityUtils.ts` - Comprehensive URL quality analysis
- `contentUtils.ts` - Content hashing, MinHash similarity, duplicate detection
- `htmlValidator.ts` - HTML structure validation, DOM depth calculation

### New Analyzer Modules

- `linkAnalyzer.ts` - Advanced link quality analysis, orphan detection
- `contentAnalyzer.ts` - Duplicate content detection, readability analysis

### Latest Additions (Closing Parity Gap)

**Robots.txt Integration:**
- Automatic fetch and parsing at crawl start
- Respects robots.txt rules (can be disabled with `--ignore-robots`)
- Crawl-delay support
- Sitemap extraction from robots.txt
- Blocked URL tracking

**Sitemap Analysis (Complete Category):**
- Auto-detection from robots.txt and common locations
- XML parsing with sitemap index support
- Size validation (>50k URLs, >50MB warnings)
- Comparison with crawled pages
- Orphan URL detection (in sitemap but not linked)
- Non-indexable URL detection in sitemap
- Runs by default on every crawl

**Schema.org Validation (Complete Category):**
- Validates JSON-LD structure (@context, @type)
- 15+ schema types with required property checking
- Type-specific validation (URLs, dates, arrays)
- Property type validation
- Detailed error and warning messages

**Enhanced Robots Directives:**
- Complete directive set: none, unavailable_after, nosnippet, noodp, noydir, notranslate
- Max-snippet, max-image-preview, max-video-preview detection
- Misplaced directive detection (outside head)
- Deprecated directive warnings

**Advanced Image Checks:**
- Missing width/height attribute detection
- Very long alt text (>125 chars)
- Enhanced image quality analysis

**Performance & Resource Analysis:**
- Render-blocking resource detection (CSS/JS in head)
- External resource counting
- Large inline script/style detection (>10KB)
- Excessive redirect chain detection (>2)

**Enhanced HTML Validation:**
- DOCTYPE validation
- Deprecated element detection
- Comprehensive structure checks

**Advanced Pagination:**
- Thin content warnings on paginated pages
- Noindex recommendations for deep pagination

**Enhanced Hreflang:**
- Duplicate language code detection
- x-default validation for multi-language sites
- Out-of-head detection

**Enhanced Canonical:**
- Self-referencing validation
- Missing canonical on parameterized pages
- Non-self-referencing detection

### Breaking Changes

- Enhanced `PageMetadata` interface with 15+ new optional fields
- Enhanced `PerformanceMetrics` with resource tracking
- Enhanced `ImageData` with dimension attributes
- New dependencies: `nspell`, `dictionary-en`, `robots-parser`, `fast-xml-parser`
- `parseMetadata()` now accepts `headers` parameter for security analysis
- `crawlSite()` now integrates robots.txt checking

### Developer Experience

- Expanded TypeScript types for all new metrics
- Improved error handling and validation
- Better separation of concerns with specialized analyzer modules
- More detailed inline documentation

## [1.1.9] - 2025-10-16

Minor bug fixes and improvements.

## [1.1.8] - 2025-10-16

Minor bug fixes and improvements.

## [1.1.7] - 2025-10-16

Minor bug fixes and improvements.

## [1.1.6] - 2025-10-16

See CHANGELOG entries above for feature details from 1.1.6.

## [1.1.2] - 2025-10-16

See CHANGELOG entries above for feature details from 1.1.2.

## [1.0.2] - 2025-10-15

Minor bug fixes.

## [1.0.1] - 2025-10-15

### Rename and version reset

- Package renamed to `seo-reporter`
- CLI name standardized as `seo-reporter`
- Updated default user agent to `SEO-Reporter/1.0`
- Documentation updated to reflect new name and command

## [1.0.0] - 2025-10-15

### Initial Release

A TypeScript CLI tool for crawling websites and analyzing SEO metadata.

**Core Features:**
- Website crawling with configurable depth and concurrency
- Comprehensive metadata extraction (titles, descriptions, canonical, robots, Open Graph, Twitter Cards, hreflang, structured data)
- Automatic issue detection (missing tags, duplicates, length problems, conflicts)
- Beautiful HTML reports with per-page details and site-wide summaries
- Fast, memory-efficient processing with concurrent requests

**Technologies:**
- TypeScript with strict type checking
- Axios (HTTP), Cheerio (parsing), Commander (CLI), Handlebars (templates)
- Modular architecture for extensibility

**Known Limitations:**
- No JavaScript rendering (static HTML only)
- No robots.txt parsing
- No broken link detection

See README.md for full documentation and usage examples.

