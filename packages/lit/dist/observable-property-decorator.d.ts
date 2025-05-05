export declare function observed(options?: {
    throttleUpdatesDelay: number;
}): (target: any, propertyName: any) => {
    get(): any;
    set: (value: any) => void;
    enumerable: boolean;
    configurable: boolean;
};
//# sourceMappingURL=observable-property-decorator.d.ts.map