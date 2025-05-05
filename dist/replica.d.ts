import { PatchDiff } from "../patch-diff/index";
import { WebSocketClient } from "../ws-client/ws-client";
export type LiveReplicaProxy<T = any> = T & object;
declare const deserializeFunctions: unique symbol;
declare const createRPCfunction: unique symbol;
declare const remoteApply: unique symbol;
declare const remoteOverride: unique symbol;
declare const bindToSocket: unique symbol;
export declare class Replica extends PatchDiff {
    changeRevision: number;
    onApplyEvent: any;
    onSocketReconnected: any;
    _synced: boolean;
    _subscribed: boolean;
    _subscribeInFlight: boolean;
    _destroyed: boolean;
    _connection: any;
    id: string;
    remotePath: string;
    [bindToSocket](): void;
    [createRPCfunction](path: any): (...args: any[]) => Promise<unknown>;
    [deserializeFunctions](data: any, path: any): any;
    [remoteApply](data: any, options: any): void;
    [remoteOverride](data: any): void;
    constructor(remotePath: any, options?: {
        dataObject: {};
    });
    set connection(connection: any);
    get connection(): any;
    subscribeRemote(connection?: any, subscribeSuccessCallback?: any, subscribeRejectCallback?: any): void;
    connect<T>(connection: WebSocket | WebSocketClient, remotePath: string, params: any): Promise<{
        writable: boolean;
        rpc: boolean;
    }>;
    apply(patch: any, path: any, options: any): void;
    set(fullDocument: any, path: any, options: any): void;
    splice(patch: any, path: any, options: any): void;
    remove(path: any, options: any): void;
    unsubscribeRemote(): any;
    destroy(): void;
    get isReadOnly(): boolean;
    get subscribed(): Promise<any>;
    get synced(): Promise<any>;
}
export declare function connect<T>(proxy: LiveReplicaProxy<T>, connection: WebSocket | WebSocketClient, remotePath: string, params: any): Promise<{
    writable: boolean;
    rpc: boolean;
}>;
export declare function disconnect<T>(proxy: LiveReplicaProxy<T>): Promise<any>;
export {};
//# sourceMappingURL=replica.d.ts.map