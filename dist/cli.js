#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { createSpinner } from './utils/spinner.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join, basename } from 'path';
import { crawlSite } from './crawler.js';
import { parseMetadataParallel } from './parallelParser.js';
import { analyzePages } from './analyzer.js';
import { generateReports } from './reporter.js';
import { generateCsvExports } from './exporter.js';
import { analyzeSitemap } from './sitemapAnalyzer.js';
import { isUsingNativeModule } from './contentAnalyzer.js';
import { calculateSiteScore } from './scorer.js';
import { startServer } from './server.js';
const program = new Command();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = resolve(__dirname, '../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const cliVersion = typeof pkg?.version === 'string' ? pkg.version : '1.0.0';
program
    .name('seo-reporter')
    .description('SEO Reporter: Comprehensive SEO analysis CLI with 220+ checks and rich reports')
    .version(cliVersion)
    .option('--url <url>', 'Target URL to crawl (e.g., https://example.com)')
    .option('--depth <number>', 'Maximum crawl depth', '3')
    .option('--max-pages <number>', 'Maximum number of pages to crawl', '1000')
    .option('--concurrency <number>', 'Number of concurrent requests', '10')
    .option('--output <path>', 'Output directory for reports', './seo-report')
    .option('--timeout <ms>', 'Request timeout in milliseconds', '10000')
    .option('--user-agent <string>', 'Custom user agent string', 'SEO-Reporter/1.0')
    .option('--export-csv', 'Export results to CSV files')
    .option('--respect-robots', 'Respect robots.txt rules (default: true)', true)
    .option('--ignore-robots', 'Ignore robots.txt rules')
    .option('--crawl-mode <mode>', 'Crawl mode: crawl (links only), sitemap (sitemap only), or both (default: both)', 'both')
    .option('--sitemap-url <url>', 'Custom sitemap URL (if not auto-detected)')
    .option('--validate-schema', 'Validate structured data (default: true)', true)
    .option('--debug-log', 'Enable verbose crawl logging to a file in output directory')
    .option('--log-file <path>', 'Custom log file path (overrides default)')
    .option('--min-score <number>', 'Exit with error code if site score below threshold')
    .option('--show-score', 'Print score summary to console')
    .option('--score-weights <json>', 'Custom category weights (JSON string)')
    .option('--stealth', 'Enable stealth mode with randomized user agents and headers')
    .option('--stealth-user-agents <agents...>', 'Custom user agents for stealth mode (comma-separated)')
    .option('--stealth-min-delay <ms>', 'Minimum delay between requests in stealth mode (ms)', '1000')
    .option('--stealth-max-delay <ms>', 'Maximum delay between requests in stealth mode (ms)', '5000')
    .option('--stealth-proxies <proxies...>', 'Proxy list for stealth mode (format: host:port or http://host:port)');
// Main crawl command - inherits global options through parent program
const crawlCommand = program
    .command('crawl')
    .description('Crawl and analyze a website for SEO issues');
// Also allow running without 'crawl' subcommand for backward compatibility
program
    .command('*')
    .allowUnknownOption()
    .action(async (options) => {
    const parentOpts = program.opts();
    const allOptions = { ...parentOpts, ...options };
    if (!allOptions.url) {
        program.help();
        return;
    }
    await runCrawlWorkflow(allOptions);
});
// Main crawl action (only triggered when crawl command is used)
crawlCommand
    .action(async (options, command) => {
    const parentOpts = command.parent?.opts?.() || {};
    const allOptions = { ...parentOpts, ...options };
    await runCrawlWorkflow(allOptions);
});
// Default command (when no command is specified)
program
    .action(async (options) => {
    const rootOptions = { ...program.opts(), ...options };
    if (!rootOptions.url) {
        program.help();
        return;
    }
    await runCrawlWorkflow(rootOptions);
});
async function runCrawlWorkflow(allOptions) {
    try {
        const customWeights = parseScoreWeights(allOptions.scoreWeights);
        const minScoreThreshold = allOptions.minScore !== undefined ? Number(allOptions.minScore) : undefined;
        if (minScoreThreshold !== undefined && Number.isNaN(minScoreThreshold)) {
            throw new Error('Invalid value for --min-score. Provide a numeric value.');
        }
        if (!allOptions.url) {
            throw new Error('URL is required. Use --url <url> to specify the target URL.');
        }
        const crawlMode = allOptions.crawlMode;
        if (!['crawl', 'sitemap', 'both'].includes(crawlMode)) {
            throw new Error('Invalid crawl mode. Must be one of: crawl, sitemap, both');
        }
        const debugEnabled = !!allOptions.debugLog;
        const defaultLogFile = `${allOptions.output}/crawl-debug-${Date.now()}.log`;
        const logFile = allOptions.logFile || (debugEnabled ? defaultLogFile : undefined);
        const config = {
            url: validateUrl(allOptions.url),
            depth: parseInt(allOptions.depth, 10),
            maxPages: parseInt(allOptions.maxPages, 10),
            concurrency: parseInt(allOptions.concurrency, 10),
            output: allOptions.output,
            userAgent: allOptions.userAgent,
            timeout: parseInt(allOptions.timeout, 10),
            respectRobotsTxt: allOptions.ignoreRobots ? false : allOptions.respectRobots,
            analyzeSitemaps: crawlMode === 'sitemap' || crawlMode === 'both',
            crawlMode,
            sitemapUrl: allOptions.sitemapUrl,
            debugLog: debugEnabled,
            logFile,
        };
        if (config.depth < 0) {
            throw new Error('Depth must be a non-negative number');
        }
        if (config.maxPages < 1) {
            throw new Error('Max pages must be at least 1');
        }
        if (config.concurrency < 1) {
            throw new Error('Concurrency must be at least 1');
        }
        if (config.timeout < 1000) {
            throw new Error('Timeout must be at least 1000ms');
        }
        console.log(chalk.bold.blue('\n🔍 SEO Reporter\n'));
        console.log(chalk.gray('Configuration:'));
        console.log(chalk.gray(`  URL: ${config.url}`));
        console.log(chalk.gray(`  Crawl Mode: ${config.crawlMode}`));
        console.log(chalk.gray(`  Max Depth: ${config.depth}`));
        console.log(chalk.gray(`  Max Pages: ${config.maxPages}`));
        console.log(chalk.gray(`  Concurrency: ${config.concurrency}`));
        console.log(chalk.gray(`  Output: ${config.output}`));
        if (config.debugLog && config.logFile) {
            console.log(chalk.gray(`  Debug Log: ${config.logFile}\n`));
        }
        else {
            console.log();
        }
        const crawlSpinner = createSpinner('Crawling website...').start();
        const startTime = Date.now();
        const pageData = await crawlSite(config, (current, total, _url, status) => {
            const statusColor = status >= 400 ? '🔴' : status >= 300 ? '🟡' : '🟢';
            const progress = `${current}/${Math.min(total, config.maxPages)}`;
            crawlSpinner.text = `Crawling website... ${statusColor} ${progress} pages`;
        });
        crawlSpinner.succeed(chalk.green(`Crawled ${pageData.length} pages in ${((Date.now() - startTime) / 1000).toFixed(1)}s`));
        const parseSpinner = createSpinner('Parsing SEO metadata...').start();
        const parseStartTime = Date.now();
        let parsedCount = 0;
        const pages = await parseMetadataParallel(pageData, (completed) => {
            parsedCount += completed;
            parseSpinner.text = `Parsing SEO metadata... ${parsedCount}/${pageData.length} pages`;
        });
        const parseTime = ((Date.now() - parseStartTime) / 1000).toFixed(1);
        parseSpinner.succeed(chalk.green(`Parsed metadata from ${pages.length} pages in ${parseTime}s`));
        if (!isUsingNativeModule()) {
            console.log(chalk.yellow('⚠️  Rust native module not available - using TypeScript fallback for near-duplicate detection'));
            console.log(chalk.gray('   Note: Near-duplicate detection will be slower. Run `npm rebuild` to build the Rust module.\n'));
        }
        const analyzeSpinner = createSpinner('Analyzing for SEO issues...').start();
        const analyzeStartTime = Date.now();
        const analysis = analyzePages(pages, (step, current, total) => {
            if (current !== undefined && total !== undefined) {
                analyzeSpinner.text = `Analyzing... ${step} (${current}/${total})`;
            }
            else {
                analyzeSpinner.text = `Analyzing... ${step}`;
            }
        }, { scoringWeights: customWeights });
        const analyzeTime = ((Date.now() - analyzeStartTime) / 1000).toFixed(1);
        analyzeSpinner.succeed(chalk.green(`Analysis complete in ${analyzeTime}s`));
        if (config.analyzeSitemaps) {
            const sitemapSpinner = createSpinner('Analyzing sitemap...').start();
            try {
                const sitemapInfo = await analyzeSitemap(pages, config.url, [], config.userAgent, allOptions.sitemapUrl);
                analysis.sitemapInfo = sitemapInfo;
                if (sitemapInfo.sitemapUrlCount > 0) {
                    sitemapSpinner.succeed(chalk.green(`Sitemap analyzed (${sitemapInfo.sitemapUrlCount} URLs in sitemap)`));
                }
                else {
                    sitemapSpinner.warn(chalk.yellow('No sitemap found'));
                }
            }
            catch (error) {
                sitemapSpinner.warn(chalk.yellow(`Sitemap analysis failed: ${error.message}`));
            }
        }
        analysis.siteScore = calculateSiteScore(analysis.pages, analysis.pageScores, analysis.sitemapInfo);
        if (allOptions.showScore) {
            printScoreSummary(analysis.siteScore, analysis.appliedScoringWeights);
        }
        if (minScoreThreshold !== undefined && analysis.siteScore.overallScore < minScoreThreshold) {
            console.error(chalk.red(`\n❌ Site score ${analysis.siteScore.overallScore.toFixed(1)} is below the minimum threshold of ${minScoreThreshold}.`));
            process.exitCode = 2;
        }
        console.log(chalk.bold('\n📊 Issues Found:\n'));
        const issues = analysis.issuesSummary;
        if (issues.missingTitles > 0) {
            console.log(chalk.red(`  ❌ ${issues.missingTitles} pages with missing titles`));
        }
        if (issues.missingDescriptions > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.missingDescriptions} pages with missing meta descriptions`));
        }
        if (issues.duplicateTitles > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.duplicateTitles} pages with duplicate titles`));
        }
        if (issues.duplicateDescriptions > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.duplicateDescriptions} pages with duplicate descriptions`));
        }
        if (issues.longTitles > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.longTitles} pages with titles too long (>60 chars)`));
        }
        if (issues.shortTitles > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.shortTitles} pages with titles too short (<20 chars)`));
        }
        if (issues.longDescriptions > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.longDescriptions} pages with descriptions too long (>160 chars)`));
        }
        if (issues.shortDescriptions > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.shortDescriptions} pages with descriptions too short (<50 chars)`));
        }
        if (issues.conflictingRobots > 0) {
            console.log(chalk.red(`  ❌ ${issues.conflictingRobots} pages with conflicting robots directives`));
        }
        if (issues.malformedJsonLd > 0) {
            console.log(chalk.red(`  ❌ ${issues.malformedJsonLd} pages with malformed JSON-LD`));
        }
        if (issues.missingH1 > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.missingH1} pages missing H1 tags`));
        }
        if (issues.multipleH1 > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.multipleH1} pages with multiple H1 tags`));
        }
        if (issues.brokenLinks > 0) {
            console.log(chalk.red(`  ❌ ${issues.brokenLinks} broken links (404 pages)`));
        }
        if (issues.imagesWithoutAlt > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.imagesWithoutAlt} pages with images missing alt text`));
        }
        if (issues.thinContent > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.thinContent} pages with thin content (<300 words)`));
        }
        if (issues.slowPages > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.slowPages} pages with slow load times (>3s)`));
        }
        if (issues.redirectChains > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.redirectChains} pages with redirect chains`));
        }
        if (issues.httpPages > 0) {
            console.log(chalk.red(`  ❌ ${issues.httpPages} pages using insecure HTTP`));
        }
        if (issues.mixedContent > 0) {
            console.log(chalk.red(`  ❌ ${issues.mixedContent} pages with mixed content issues`));
        }
        if (issues.orphanPages > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.orphanPages} orphan pages (no internal links)`));
        }
        if (issues.soft404s > 0) {
            console.log(chalk.red(`  ❌ ${issues.soft404s} potential soft 404s`));
        }
        if (issues.loremIpsum > 0) {
            console.log(chalk.red(`  ❌ ${issues.loremIpsum} pages with lorem ipsum text`));
        }
        if (issues.exactDuplicates > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.exactDuplicates} pages with exact duplicate content`));
        }
        if (issues.nearDuplicates > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.nearDuplicates} pages with near-duplicate content`));
        }
        if (issues.schemaErrors > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.schemaErrors} pages with schema validation errors`));
        }
        if (issues.urlQualityIssues > 0) {
            console.log(chalk.yellow(`  ⚠️  ${issues.urlQualityIssues} pages with URL quality issues`));
        }
        if (analysis.sitemapInfo) {
            if (analysis.sitemapInfo.urlsNotInSitemap.length > 0) {
                console.log(chalk.yellow(`  ⚠️  ${analysis.sitemapInfo.urlsNotInSitemap.length} crawled URLs not in sitemap`));
            }
            if (analysis.sitemapInfo.orphanUrls.length > 0) {
                console.log(chalk.yellow(`  ⚠️  ${analysis.sitemapInfo.orphanUrls.length} URLs in sitemap but not crawled`));
            }
            if (analysis.sitemapInfo.nonIndexableInSitemap.length > 0) {
                console.log(chalk.red(`  ❌ ${analysis.sitemapInfo.nonIndexableInSitemap.length} non-indexable URLs in sitemap`));
            }
        }
        const totalIssues = Object.values(issues).reduce((sum, count) => sum + count, 0);
        if (totalIssues === 0) {
            console.log(chalk.green('  ✅ No major issues found! Your site looks great.'));
        }
        else {
            console.log(chalk.gray(`\n  Total: ${totalIssues} issues across ${pages.length} pages`));
        }
        const reportSpinner = createSpinner('Generating HTML reports...').start();
        await generateReports(analysis, config.output);
        addToGitignore(config.output);
        reportSpinner.succeed(chalk.green('Reports generated successfully'));
        if (allOptions.exportCsv) {
            const csvSpinner = createSpinner('Exporting to CSV...').start();
            await generateCsvExports(analysis, config.output);
            csvSpinner.succeed(chalk.green('CSV exports generated successfully'));
        }
        console.log(chalk.bold.green(`\n✨ Complete! Reports saved to: ${config.output}`));
        console.log(chalk.gray(`   Open ${config.output}/index.html in your browser to view the results.`));
        console.log(chalk.gray(`   Or start a local server: ${chalk.cyan(`seo-reporter serve ${config.output}`)}`));
        if (allOptions.exportCsv) {
            console.log(chalk.gray(`   CSV exports available in: ${config.output}/csv/\n`));
        }
        else {
            console.log();
        }
    }
    catch (error) {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
        process.exit(1);
    }
}
/**
 * Validates a URL string
 */
function validateUrl(urlString) {
    try {
        const url = new URL(urlString);
        if (!url.protocol.startsWith('http')) {
            throw new Error('URL must use HTTP or HTTPS protocol');
        }
        return url.toString();
    }
    catch (error) {
        throw new Error(`Invalid URL: ${urlString}. Please provide a valid URL (e.g., https://example.com)`);
    }
}
function parseScoreWeights(input) {
    if (!input)
        return undefined;
    if (typeof input !== 'string') {
        throw new Error('Score weights must be provided as a JSON string.');
    }
    try {
        const raw = JSON.parse(input);
        if (typeof raw !== 'object' || raw === null) {
            throw new Error('Score weights JSON must be an object.');
        }
        const allowedKeys = ['technical', 'content', 'onPage', 'links', 'security', 'performance'];
        const weights = {};
        for (const key of allowedKeys) {
            if (Object.prototype.hasOwnProperty.call(raw, key)) {
                const value = Number(raw[key]);
                if (Number.isNaN(value) || value < 0) {
                    throw new Error(`Invalid weight for "${key}". Values must be non-negative numbers.`);
                }
                weights[key] = value;
            }
        }
        return Object.keys(weights).length ? weights : undefined;
    }
    catch (error) {
        throw new Error(`Invalid JSON for --score-weights: ${error.message}`);
    }
}
function printScoreSummary(siteScore, weights) {
    console.log(chalk.bold('\n🎯 Site Score Summary'));
    console.log(chalk.cyan(`  Overall Score: ${siteScore.overallScore.toFixed(1)} (${siteScore.totalPages} pages analyzed)`));
    console.log(chalk.gray(`  Average Page Score: ${siteScore.averagePageScore.toFixed(1)} | Top 20%: ${siteScore.topPagesScore.toFixed(1)}`));
    console.log(chalk.gray(`  Pages without critical issues: ${siteScore.percentageWithoutErrors.toFixed(1)}%`));
    console.log(chalk.gray('  Category Averages:'));
    for (const [category, value] of Object.entries(siteScore.categoryAverages)) {
        console.log(chalk.gray(`    • ${formatCategoryLabel(category)}: ${value.toFixed(1)}`));
    }
    if (weights) {
        console.log(chalk.gray('  Applied Weights:'));
        for (const [category, value] of Object.entries(weights)) {
            console.log(chalk.gray(`    • ${formatCategoryLabel(category)}: ${(value * 100).toFixed(0)}%`));
        }
    }
    if (siteScore.topIssues && siteScore.topIssues.length) {
        console.log(chalk.gray('  Top Issues by Impact:'));
        siteScore.topIssues.slice(0, 3).forEach(issue => {
            console.log(chalk.gray(`    • ${issue.issue} (${issue.affectedPages} pages, avg impact ${issue.averageImpact.toFixed(1)})`));
        });
    }
    console.log();
}
function formatCategoryLabel(category) {
    switch (category) {
        case 'technical': return 'Technical SEO';
        case 'content': return 'Content Quality';
        case 'onPage': return 'On-Page SEO';
        case 'links': return 'Links & Architecture';
        case 'security': return 'Security';
        case 'performance': return 'Performance';
        default: return category;
    }
}
/**
 * Adds the output directory to .gitignore if it's not already there
 */
function addToGitignore(outputPath) {
    try {
        // Get the directory name from the output path
        const outputDir = basename(resolve(outputPath));
        // Look for .gitignore in current working directory
        const gitignorePath = join(process.cwd(), '.gitignore');
        let gitignoreContent = '';
        let needsUpdate = false;
        // Read existing .gitignore if it exists
        if (existsSync(gitignorePath)) {
            gitignoreContent = readFileSync(gitignorePath, 'utf8');
            // Check if output directory is already in .gitignore
            const lines = gitignoreContent.split('\n');
            const hasOutputDir = lines.some(line => {
                const trimmed = line.trim();
                return trimmed === outputDir ||
                    trimmed === `${outputDir}/` ||
                    trimmed === `/${outputDir}/` ||
                    trimmed === `/${outputDir}`;
            });
            if (!hasOutputDir) {
                needsUpdate = true;
                // Add to end with proper formatting
                if (!gitignoreContent.endsWith('\n')) {
                    gitignoreContent += '\n';
                }
                gitignoreContent += `${outputDir}/\n`;
            }
        }
        else {
            // Create new .gitignore with the output directory
            needsUpdate = true;
            gitignoreContent = `# SEO Reporter output\n${outputDir}/\n`;
        }
        // Write updated .gitignore if needed
        if (needsUpdate) {
            writeFileSync(gitignorePath, gitignoreContent, 'utf8');
        }
    }
    catch (error) {
        // Silently fail - not critical if .gitignore update fails
        // (user might not be in a git repository)
    }
}
// Add serve command
program
    .command('serve [directory]')
    .description('Start a local server to view SEO reports')
    .option('-p, --port <number>', 'Port to listen on', '8080')
    .action((directory, options) => {
    const reportDir = directory || './seo-report';
    const port = parseInt(options.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
        console.error(chalk.red('❌ Error: Invalid port number. Must be between 1 and 65535.'));
        process.exit(1);
    }
    startServer({ directory: reportDir, port });
});
// Parse command line arguments
program.parse();
//# sourceMappingURL=cli.js.map