#!/usr/bin/env node
import http from 'http';
import fs from 'fs';
import path from 'path';
// MIME types for common file extensions
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
};
/**
 * Simple static file server for viewing SEO reports
 */
export function startServer(options) {
    const { directory, port } = options;
    const absoluteDir = path.resolve(directory);
    // Verify directory exists
    if (!fs.existsSync(absoluteDir)) {
        console.error(`❌ Error: Directory not found: ${absoluteDir}`);
        process.exit(1);
    }
    const server = http.createServer((req, res) => {
        // Parse URL and remove query string
        const parsedUrl = new URL(req.url || '/', `http://localhost:${port}`);
        let pathname = parsedUrl.pathname;
        // Default to index.html for directory requests
        if (pathname === '/' || pathname.endsWith('/')) {
            pathname += 'index.html';
        }
        // Construct file path
        const filePath = path.join(absoluteDir, pathname);
        // Security check: ensure the file is within the served directory
        const normalizedPath = path.normalize(filePath);
        if (!normalizedPath.startsWith(absoluteDir)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('403 Forbidden');
            return;
        }
        // Read and serve the file
        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('404 Not Found');
                }
                else {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('500 Internal Server Error');
                }
                return;
            }
            // Determine content type
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            // Serve the file
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache',
            });
            res.end(data);
        });
    });
    server.listen(port, () => {
        console.log(`\n🚀 SEO Report Server running!`);
        console.log(`\n📊 View your report at:`);
        console.log(`   http://localhost:${port}\n`);
        console.log(`📁 Serving: ${absoluteDir}`);
        console.log(`\n💡 Press Ctrl+C to stop the server\n`);
    });
    // Handle server errors
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ Error: Port ${port} is already in use.`);
            console.log(`   Try a different port with --port <number>`);
        }
        else {
            console.error(`❌ Server error:`, err.message);
        }
        process.exit(1);
    });
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n👋 Shutting down server...');
        server.close(() => {
            console.log('✅ Server stopped\n');
            process.exit(0);
        });
    });
}
// CLI usage when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    // Parse arguments
    let directory = './seo-report';
    let port = 8080;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--directory' || args[i] === '-d') {
            directory = args[++i];
        }
        else if (args[i] === '--port' || args[i] === '-p') {
            port = parseInt(args[++i], 10);
        }
        else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
SEO Report Server - Simple static file server for viewing reports

Usage:
  seo-reporter serve [options]
  
Options:
  -d, --directory <path>   Directory to serve (default: ./seo-report)
  -p, --port <number>      Port to listen on (default: 8080)
  -h, --help               Show this help message

Examples:
  seo-reporter serve
  seo-reporter serve --directory seo-report-example --port 3000
  seo-reporter serve -d ./reports -p 8888
`);
            process.exit(0);
        }
        else {
            // Assume first positional argument is directory
            directory = args[i];
        }
    }
    if (isNaN(port) || port < 1 || port > 65535) {
        console.error('❌ Error: Invalid port number. Must be between 1 and 65535.');
        process.exit(1);
    }
    startServer({ directory, port });
}
//# sourceMappingURL=server.js.map