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

export interface ObserverCallback {
    (diff: any, changeInfo: ChangeInfo, context: any, isAggregated: boolean): void;
}

export interface PatchOptions {
    overrides?: any;
    defer?: boolean;
}

export interface LiveReplicaProxy<T = any> {
    [key: string]: any;
}

export interface LiveReplicaConstructor {
    create<T>(data: T, options?: ProxyOptions): LiveReplicaProxy<T>;
}

export interface LiveReplicaModule {
    Replica: LiveReplicaConstructor;
} 