declare const redis: any;
export declare const cache: (keyPrefix: string, ttlSeconds: number) => (req: any, res: any, next: any) => Promise<any>;
export declare const clearCache: (pattern: string) => Promise<void>;
export { redis };
//# sourceMappingURL=cache.d.ts.map