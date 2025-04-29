export * from './dist/patch-diff';
export { default } from './dist/patch-diff';

declare module '@live-replica/patch-diff' {
    export default class PatchDiff {
        constructor(data: any);
        get(): any;
        getData(): any;
        set(value: any, path?: string, options?: any): void;
        apply(value: any, path?: string, options?: any): void;
        subscribe(callback: (diff: any, changeInfo: any, context: any, isAggregated: boolean) => void): () => void;
    }
}
//# sourceMappingURL=index.d.ts.map