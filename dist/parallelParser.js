/**
 * Parallel HTML parser using worker threads
 */
import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Parse pages in parallel using worker threads
 * Distributes work across CPU cores for 4-8x speedup
 */
export async function parseMetadataParallel(pageData, onProgress) {
    if (pageData.length === 0) {
        return [];
    }
    // Determine number of workers (use all CPU cores)
    const numCpus = cpus().length;
    const numWorkers = Math.min(numCpus, pageData.length);
    // Debug: Log worker info
    let useWorkers = pageData.length >= 50 && numWorkers > 1;
    // Resolve worker file path and verify existence (dev runs won't have .js worker)
    const workerPath = join(__dirname, 'parser.worker.js');
    if (useWorkers && !existsSync(workerPath)) {
        // Fallback to sequential parsing when worker bundle is not present (e.g., tsx/dev mode)
        useWorkers = false;
    }
    // For small datasets or when worker file is not available, use sequential parsing
    if (!useWorkers) {
        const { parseMetadata } = await import('./parser.js');
        return Promise.all(pageData.map(page => parseMetadata(page.html, page.url, page.status, page.depth, page.responseTime, page.redirectChain, page.headers || {}, 'SEO-CommandLine-Tool/1.0', true // Enable link validation
        )));
    }
    // Split pages into chunks for each worker
    const chunkSize = Math.ceil(pageData.length / numWorkers);
    const chunks = [];
    for (let i = 0; i < pageData.length; i += chunkSize) {
        chunks.push(pageData.slice(i, i + chunkSize));
    }
    // Create workers and process chunks
    const workers = [];
    const promises = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const promise = new Promise((resolve, reject) => {
            const worker = new Worker(workerPath);
            workers.push(worker);
            worker.on('message', (message) => {
                if (message.success && message.results) {
                    if (onProgress) {
                        const completed = message.results.length;
                        onProgress(completed, pageData.length);
                    }
                    resolve(message.results);
                }
                else {
                    reject(new Error(message.error || 'Unknown worker error'));
                }
            });
            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
            });
            // Send chunk to worker
            worker.postMessage(chunk);
        });
        promises.push(promise);
    }
    try {
        // Wait for all workers to complete
        const results = await Promise.all(promises);
        // Flatten results
        const allPages = results.flat();
        return allPages;
    }
    finally {
        // Clean up workers
        for (const worker of workers) {
            await worker.terminate();
        }
    }
}
//# sourceMappingURL=parallelParser.js.map