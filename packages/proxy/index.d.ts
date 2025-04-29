declare module '@live-replica/proxy' {
    export interface ProxyOptions {
        allowWrite?: boolean;
        immediateFlush?: boolean;
    }

    export interface ChangeInfo {
        snapshot?: boolean;
        differences?: any;
        updates?: {
            newVal?: any;
            oldVal?: any;
        };
        local?: boolean;
    }

    export interface PatchOptions {
        overrides?: any;
        defer?: boolean;
    }

    export function get(proxy: any, path: string): any;
    export function set(proxy: any, path: string, value: any, options?: PatchOptions): void;
    export function merge(proxy: any, value: any, options?: PatchOptions): void;
    export function cloneDeep(proxy: any, path?: string): any;
    export function replace(proxy: any, value: any, options?: PatchOptions): void;
    export function observe(proxy: any, path: string | ((diff: any, changeInfo: ChangeInfo, context: any, isAggregated: boolean) => void), callback?: (diff: any, changeInfo: ChangeInfo, context: any, isAggregated: boolean) => void): () => void;
    export function nextChange(proxy: any): Promise<any>;
    export function patch(proxy: any, path: string, value: any, options?: PatchOptions): void;
} 