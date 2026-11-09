// customer exposed data
export interface CacheEntry<T = unknown>{
    key: string;
    value: T;
    expiresAt: number | null;
}

// Entry DTO
export type CreateCacheInput = {
    key: string;
    value: unknown;
    ttl?: number; // in seconds
}