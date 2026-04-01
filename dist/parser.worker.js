/**
 * Worker thread for parallel HTML parsing
 */
import { parentPort } from 'worker_threads';
import { parseMetadata } from './parser.js';
if (!parentPort) {
    throw new Error('This file must be run as a worker thread');
}
// Listen for messages from main thread
parentPort.on('message', async (pages) => {
    try {
        // Parse all pages assigned to this worker
        const results = await Promise.all(pages.map(page => parseMetadata(page.html, page.url, page.status, page.depth, page.responseTime, page.redirectChain, page.headers || {}, 'SEO-CommandLine-Tool/1.0', true // Enable link validation
        )));
        // Send results back to main thread
        parentPort.postMessage({ success: true, results });
    }
    catch (error) {
        // Send error back to main thread
        parentPort.postMessage({ success: false, error: error.message });
    }
});
//# sourceMappingURL=parser.worker.js.map