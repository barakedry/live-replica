import type { LiveReplicaProxy, PatchDiff, SubscribeCallback, UnsubscribeCallback, MutationOptions } from '@live-replica/live-replica';
export declare function hasProxy(value: object): boolean;
export declare function getProxy<T = any>(value: T): LiveReplicaProxy<T> | undefined;
export declare function isProxy(proxy: object): boolean;
export declare function unwrap<T = any>(valueOrProxy: T): T;
export declare function getPatchDiff<T = any>(proxy: LiveReplicaProxy<T>): PatchDiff<T>;
export declare function observe<T = any>(proxy: LiveReplicaProxy<T>, path: string | SubscribeCallback<T>, cb?: SubscribeCallback<T>): UnsubscribeCallback;
export declare const subscribe: typeof observe;
export declare function nextChange<T = any>(proxy: LiveReplicaProxy<T>): Promise<Partial<T>>;
export declare function replace<T = any>(proxy: LiveReplicaProxy<T>, value: T, options?: MutationOptions): LiveReplicaProxy<T>;
export declare function get<T = any>(proxy: LiveReplicaProxy<T>, path: string): any;
export declare function set<T = any>(proxy: LiveReplicaProxy<T>, path: string, value: any, options?: MutationOptions): void;
export declare function patch<T = any>(proxy: LiveReplicaProxy<T>, path: string, value: any, options?: MutationOptions): void;
export declare function merge<T = any>(proxy: LiveReplicaProxy<T>, partial: Partial<T>): void;
export declare function cloneDeep<T = any>(proxy: LiveReplicaProxy<T>, path?: string): T;
export declare function revoke(targetOrProxy: object): boolean;
export declare function create<T = any>(patchDiff: PatchDiff<T>, options?: {
    readonly?: boolean;
    immediateFlush?: boolean;
}): LiveReplicaProxy<T>;
export declare const createProxy: typeof create;
//# sourceMappingURL=proxy.d.ts.map