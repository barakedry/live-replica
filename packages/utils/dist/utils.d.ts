export declare function concatPath(path: string, suffix: string): string | undefined;
export declare function isValid(val: any): boolean;
export declare function pushKeyToPath(path?: string, key?: string, isIndex?: boolean): string;
export declare function pathParts(path: string): (string | number)[];
export declare function splitPathAndLastKey(fullPath: string): {
    path: string;
    key: string;
    index?: number;
};
export declare function lastPathKey(path: string): string | number;
export declare function firstKey(path: string): string;
export declare function parentPath(path: string): string;
export declare function wrapByPath(value: any, path: string): any;
export declare function hasSamePrototype(obj1: any, obj2: any): boolean;
export declare function once<T extends (...args: any[]) => any>(fn: T): T;
export declare function createWrapperWithLastKey(path: string): {
    wrapper: any;
    wrapperInner: any;
    lastKey: string | number;
};
export declare function fixNumericParts(path: string): string;
export declare function pickWithKeys(obj: any, keys: string[], allowEmptyObject?: boolean): any;
export declare const SERIALIZED_FUNCTION = "function()";
export declare const Utils: {
    isValid: typeof isValid;
    concatPath: typeof concatPath;
    pushKeyToPath: typeof pushKeyToPath;
    pathParts: typeof pathParts;
    splitPathAndLastKey: typeof splitPathAndLastKey;
    lastPathKey: typeof lastPathKey;
    firstKey: typeof firstKey;
    parentPath: typeof parentPath;
    wrapByPath: typeof wrapByPath;
    hasSamePrototype: typeof hasSamePrototype;
    once: typeof once;
    createWrapperWithLastKey: typeof createWrapperWithLastKey;
    fixNumericParts: typeof fixNumericParts;
    pickWithKeys: typeof pickWithKeys;
    SERIALIZED_FUNCTION: string;
};
//# sourceMappingURL=utils.d.ts.map