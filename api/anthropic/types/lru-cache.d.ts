declare module 'lru-cache' {
    export class LRUCache<K, V> {
        constructor(options?: LRUCache.Options<K, V>);
        set(key: K, value: V, options?: { ttl?: number }): boolean;
        get(key: K): V | undefined;
        has(key: K): boolean;
        delete(key: K): boolean;
        clear(): void;
        length: number;
        itemCount: number;
    }

    export namespace LRUCache {
        export interface Options<K, V> {
            max?: number;
            ttl?: number;
            updateAgeOnGet?: boolean;
            allowStale?: boolean;
            maxSize?: number;
            sizeCalculation?: (value: V, key: K) => number;
            dispose?: (value: V, key: K) => void;
            noDisposeOnSet?: boolean;
            disposeAfter?: (value: V, key: K) => void;
        }
    }
}
