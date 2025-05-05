export declare class MiddlewareChain {
    chain: any[];
    owner: any;
    constructor(owner?: any);
    start(...args: any[]): void;
    add(middleware: any): void;
    use(middleware: any): void;
    remove(middleware: any): void;
    _run(index: number, finishCallback: any, args: any[]): any;
    clear(): void;
}
export default MiddlewareChain;
//# sourceMappingURL=middleware-chain.d.ts.map