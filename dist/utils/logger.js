import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
function timestamp() {
    const d = new Date();
    return d.toISOString();
}
async function ensureDir(path) {
    try {
        await mkdir(path, { recursive: true });
    }
    catch {
        // ignore
    }
}
export function createLogger(filePath) {
    if (!filePath) {
        const noop = async (_) => { };
        return { info: noop, warn: noop, error: noop, debug: noop };
    }
    const dir = dirname(filePath);
    // best-effort ensure directory
    ensureDir(dir).catch(() => { });
    const write = async (level, msg) => {
        const line = `[${timestamp()}] [${level}] ${msg}\n`;
        try {
            await appendFile(filePath, line, 'utf8');
        }
        catch {
            // ignore logging failures
        }
    };
    return {
        info: (m) => write('INFO', m),
        warn: (m) => write('WARN', m),
        error: (m) => write('ERROR', m),
        debug: (m) => write('DEBUG', m),
    };
}
//# sourceMappingURL=logger.js.map