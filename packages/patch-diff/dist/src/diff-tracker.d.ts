declare function create(diffsAsArray: boolean, deletePatch?: boolean): {
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
};
export declare const DiffTracker: {
    create: typeof create;
};
export {};
//# sourceMappingURL=diff-tracker.d.ts.map