import { EventEmitter } from '../../events/events';
type GetAllResult<T> = {
    params: Record<string, string>;
    value: T | undefined;
    isPattern: boolean;
};
export declare const DeleteKeyword = "__$$D";
export declare const SpliceKeyword = "__$$S";
export declare const UndefinedKeyword = "__$$U";
export declare const ProtoKeyword = "__$$P";
export type KeyList = string[] | Set<string>;
export type DiffInfo<T = any> = {
    snapshot?: boolean;
    hasAdditions?: boolean;
    hasAddedObjects?: boolean;
    hasDeletions?: boolean;
    hasUpdates?: boolean;
    hasDifferences?: boolean;
    additions?: T extends Array<any> ? Array<T[number]> : Partial<T>;
    deletions?: Partial<T>;
    updates?: Partial<T>;
    addedObjects?: Partial<T>;
    differences?: T extends Array<any> ? Array<T[number]> : Partial<T>;
    changeType?: 'displace' | 'change' | '';
};
export type SubscribeCallback<T = any> = (patchOrSnapshot?: Partial<T>, changeInfo?: DiffInfo<T>, context?: any, deferred?: boolean, params?: Record<string, any>) => void;
export type UnsubscribeCallback = () => void;
export type SpliceParams = {
    index: number;
    itemsToRemove: number;
    itemsToAdd?: any[];
};
export type MutationOptions = {
    defer?: boolean;
    context?: any;
    [key: string]: any;
};
export type MergeOptions = MutationOptions & {
    overrides?: Record<string, true> | string[];
};
export type ApplyOptions = {
    emitEvents?: boolean;
    maxKeysInLevel?: number;
    maxLevels?: number;
    maxListeners?: number;
};
export type ProxyOptions = {
    readonly: boolean;
};
export declare class PatchDiff<T = any> extends EventEmitter {
    options: Required<ApplyOptions> & {
        undefinedKeyword: string;
        deleteKeyword: string;
        spliceKeyword: string;
        protoKeyword: string;
        fireGlobalChangeEvents: boolean;
        maxKeysInLevel: number;
        maxLevels: number;
        maxListeners: number;
        disableSplices: boolean;
        [key: string]: any;
    };
    proxies: WeakMap<object, any>;
    _data: T;
    _whitelist?: Set<string>;
    _path?: string;
    _root?: PatchDiff<T>;
    _wrapper?: any;
    _wrapperInner?: any;
    _wrapperKey?: string;
    _subs?: any;
    listenedPaths: string[];
    constructor(object?: T, options?: Partial<ApplyOptions> & {
        [key: string]: any;
    });
    apply(patch: any, path?: string, options?: ApplyOptions): void;
    displace(value: any, path?: string, options?: MutationOptions): void;
    set(fullDocument?: any, path?: string, options?: MutationOptions): void;
    remove(path?: string, options?: MutationOptions): void;
    splice({ index, itemsToRemove, itemsToAdd }: {
        index: number;
        itemsToRemove: number;
        itemsToAdd?: any[];
    }, path?: string, options?: MutationOptions): void;
    getFullPath(path: any): string | undefined;
    getAll(pathPattern: any): GetAllResult<T>[] | {
        value: any;
        params: {};
        isPattern: boolean;
    }[];
    get(path?: string, callback?: (value: any) => void): any;
    getClone(path?: string): any;
    on(event: any, fn: any, prependPath?: boolean): void;
    whitelist(keySet: any): void;
    subscribe(subPath: string, fn?: SubscribeCallback, skipInitial?: boolean): () => void;
    getWhenExists(path: any): Promise<unknown>;
    whenAnything(path: any): Promise<unknown>;
    at(subPath: string): any;
    parent(): any;
    get root(): PatchDiff<T>;
    /************************************************************************************
     * The basic merging recursion implementation:
     * ._applyObject() -> ._applyAtKey() -> ._applyObject() -> ._applyAtKey() -> ...
     *
     * ._applyObject() iterate keys at level and calls ._applyAtKey() for each key,
     * after iteration ends it emits and returns level changes to the caller.
     *
     * ._applyAtKey() assigns/remove primitives and calls _.applyObject() for objects
     ************************************************************************************/
    _applyObject(target: any, patch: any, path: any, options: any, level: any, override: any): any;
    _applyAtKey(target: any, patch: any, path: any, key: any, levelDiffs: any, options: any, level: any, override: any, isTargetArray: any): any;
    _deleteAtKey(target: any, path: any, key: any, options: any, existingValue: any, levelDiffs: any, isArray: any): any;
    _detectDeletionsAtLevel(target: any, patch: any, levelDiffs: any, path: any, options: any, isTargetArray: any): any;
    _splice(path: string, index: number, itemsToRemove: number, ...itemsToAdd: any[]): {
        index: number;
        itemsToRemove: number;
        itemsToAdd: any[];
        deleted: any[];
    } | {
        deleted: never[];
    };
    _getPrototypeOf(object: any): any;
    _emitInnerDeletions(path: any, deletedObject: any, options: any): {
        hasAdditions: boolean;
        hasAddedObjects: boolean;
        hasDeletions: boolean;
        hasUpdates: boolean;
        hasDifferences: boolean;
        additions: {};
        deletions: {};
        updates: {};
        addedObjects: {};
        differences: {};
        deletePatch: boolean;
        addChildTracking: (childTracker: any, key: any, isNewObject?: boolean) => void;
    } | undefined;
    get isReadOnly(): boolean;
    getData({ immediateFlush }?: {}): LiveReplicaProxy<T_1>;
    destroyProxy(): void;
    get data(): LiveReplicaProxy<T_1>;
}
export default PatchDiff;
//# sourceMappingURL=patch-diff.d.ts.map