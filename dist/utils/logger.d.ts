export interface Logger {
    info: (message: string) => Promise<void>;
    warn: (message: string) => Promise<void>;
    error: (message: string) => Promise<void>;
    debug: (message: string) => Promise<void>;
}
export declare function createLogger(filePath?: string): Logger;
//# sourceMappingURL=logger.d.ts.map