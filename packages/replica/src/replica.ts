import { PatchDiff, PatchDiffOptions, DeleteKeyword, SpliceKeyword, UndefinedKeyword, ProtoKeyword } from '@live-replica/patch-diff';
import { LiveReplicaSocket } from '@live-replica/socket';
import { createProxy } from '@live-replica/proxy';
import { concatPath } from '@live-replica/utils';
import { WebSocketClient } from '@live-replica/ws-client';
import { EventEmitter } from '@live-replica/events';

type EventListener = (...args: any[]) => void;

function generateUniqueId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}`;
}

// Private symbols
const deserializeFunctions = Symbol('deserializeFunctions');
const createRPCfunction = Symbol('createRPCfunction');
const remoteApply = Symbol('remoteApply');
const remoteOverride = Symbol('remoteOverride');
const bindToSocket = Symbol('bindToSocket');

const LocalMutation = Object.freeze({context: {local: true}});

export interface ReplicaOptions {
    connection?: LiveReplicaSocket;
    allowWrite?: boolean;
    allowRPC?: boolean;
    dataObject?: Record<string, any>;
    params?: object;
    subscribeRemoteOnCreate?: boolean;
    subscribeSuccessCallback?: (result: any) => void;
    subscribeRejectCallback?: (reason: string) => void;
    emitEvents?: boolean;
    undefinedKeyword?: string;
    deleteKeyword?: string;
    spliceKeyword?: string;
    protoKeyword?: string;
    fireGlobalChangeEvents?: boolean;
    maxKeysInLevel?: number;
    maxLevels?: number;
    maxListeners?: number;
    disableSplices?: boolean;
    overrides?: string[];
    context?: any;
    defer?: boolean;
}

export class Replica {
    private _patchDiff: PatchDiff;
    private _replicaOptions: ReplicaOptions;
    public remotePath: string;
    public id: string;
    private _connection?: LiveReplicaSocket;
    private _synced: boolean = false;
    private _subscribed: boolean = false;
    private _subscribeInFlight?: boolean;
    private _destroyed?: boolean;
    private changeRevision: number = 0;
    private onApplyEvent: ((delta: any, meta?: any) => void) | undefined;
    private onSocketReconnected?: () => void;

    constructor(remotePath: string, options: Partial<ReplicaOptions> = {dataObject: {}}) {
        const patchDiffOptions = {
            emitEvents: true,
            undefinedKeyword: UndefinedKeyword,
            deleteKeyword: DeleteKeyword,
            spliceKeyword: SpliceKeyword,
            protoKeyword: ProtoKeyword,
            fireGlobalChangeEvents: false,
            maxKeysInLevel: 10000,
            maxLevels: 60,
            maxListeners: 1000000,
            disableSplices: true,
            overrides: [],
            context: undefined,
            defer: false,
            ...options
        };

        this._patchDiff = new PatchDiff({}, patchDiffOptions);
        this._replicaOptions = options;
        this.remotePath = remotePath;
        this.id = generateUniqueId();

        if (options.dataObject) {
            this._patchDiff.apply(options.dataObject);
        }

        if (options.subscribeRemoteOnCreate) {
            this.subscribeRemote(options.connection);
        }
    }

    get data(): any {
        return this._patchDiff.get();
    }

    get(path?: string): any {
        return this._patchDiff.get(path);
    }

    set(data: any, path?: string, options?: PatchDiffOptions): void {
        if (this._replicaOptions.allowWrite) {
            this._patchDiff.apply(data, path, options ? {...options, ...LocalMutation} : LocalMutation);
        }
    }

    apply(patch: any, path?: string, options?: PatchDiffOptions): void {
        if (this._replicaOptions.allowWrite) {
            this._patchDiff.apply(patch, path, options ? {...options, ...LocalMutation} : LocalMutation);
        }
    }

    at(path: string): PatchDiff {
        return this._patchDiff.at(path);
    }

    subscribe(callback: EventListener): () => void {
        return this._patchDiff.on('change', callback);
    }

    override = this.set;
    disconnect = this.unsubscribeRemote;

    // Implement EventEmitter methods
    emit(event: string, ...args: any[]): void {
        this._patchDiff.emit(event, ...args);
    }

    on(event: string, cb: EventListener): () => void {
        return this._patchDiff.on(event, cb);
    }

    once(event: string, cb: EventListener): () => void {
        return this._patchDiff.once(event, cb);
    }

    off(event: string, cb: EventListener): void {
        this._patchDiff.off(event, cb);
    }

    // Private methods
    private [bindToSocket](): void {
        this.changeRevision = 0;
        this.onApplyEvent = (delta: any, meta: any = {}) => {
            if (meta.snapshot || meta.displace) {
                this[remoteOverride](delta);
            } else {
                this.changeRevision = meta.changeRevision;
                const applyOptions = meta.deletePatch ? {deletePatch: true} : undefined;
                this[remoteApply](delta, applyOptions);
            }

            if (!this._synced) {
                this._synced = true;
                this.emit('_synced', this.get());
            }
        };

        if (this._connection) {
            this._connection.on(`apply:${this.id}`, this.onApplyEvent);
        }
    }

    private [createRPCfunction](path: string): (...args: any[]) => Promise<any> {
        const self = this;
        return function rpcToRemote(...args: any[]): Promise<any> {
            return new Promise((resolve, reject) => {
                self.connection?.send(`invokeRPC:${self.id}`, {path, args}, (returnValue: any) => {
                    if (returnValue?.$error) {
                        const err = new Error(returnValue.$error.message);
                        err.name = returnValue.$error.name;
                        reject(err);
                    } else {
                        resolve(returnValue);
                    }
                });
            });
        }
    }

    private [deserializeFunctions](data: any, path?: string): any {
        if (typeof data !== 'object' || data === null) {
            return data;
        }

        const keys = Object.keys(data);
        for (let i = 0, l = keys.length; i < l; i++) {
            const key = keys[i];
            const value = data[key];

            if (value === 'function()') {
                data[key] = this[createRPCfunction](concatPath(path || '', key));
            } else if (typeof value === 'object' && value !== null) {
                this[deserializeFunctions](value, concatPath(path || '', key));
            }
        }
        return data;
    }

    private [remoteApply](data: any, options?: any): void {
        this._patchDiff.apply(this[deserializeFunctions](data), undefined, options);
    }

    private [remoteOverride](data: any): void {
        this._patchDiff.apply(this[deserializeFunctions](data));
    }

    set connection(connection: LiveReplicaSocket | undefined) {
        if (connection && this._destroyed) {
            throw Error('replica is destroyed');
        }

        if (this._connection && this.onApplyEvent) {
            this._connection.off(`apply:${this.id}`, this.onApplyEvent);
        }

        if (this._connection && this.onSocketReconnected) {
            this._connection.off('reconnect', this.onSocketReconnected);
        }

        this._connection = connection;
    }

    get connection(): LiveReplicaSocket | undefined {
        return this._connection;
    }

    subscribeRemote(
        connection: LiveReplicaSocket | undefined = this._replicaOptions.connection,
        subscribeSuccessCallback: ((result: any) => void) | undefined = this._replicaOptions.subscribeSuccessCallback,
        subscribeRejectCallback: ((reason: string) => void) | undefined = this._replicaOptions.subscribeRejectCallback
    ): void {
        if (this._destroyed) {
            throw Error('replica is destroyed');
        }

        if (!(connection && connection instanceof LiveReplicaSocket)) {
            throw Error('undefined connection or not a LiveReplicaSocket');
        }

        if (this._subscribed || this._subscribeInFlight) {
            this.unsubscribeRemote();
        }

        this._subscribed = false;
        this._synced = false;

        if (connection !== this.connection) {
            this.connection = connection;
            this[bindToSocket]();

            this.onSocketReconnected = () => {
                this.subscribeRemote(connection);
            };

            connection.on('reconnect', this.onSocketReconnected);
        }

        connection.send('subscribe', {
            id: this.id,
            path: this.remotePath,
            allowRPC: this._replicaOptions.allowRPC,
            allowWrite: this._replicaOptions.allowWrite,
            params: this._replicaOptions.params
        }, (result: any) => {
            this._subscribeInFlight = false;

            if (result.success) {
                console.info(`live-replica subscribed to remote path=${this.remotePath} writable=${result.writable} rpc=${result.rpc}`);
                this._replicaOptions.allowWrite = result.writable;

                this._subscribed = true;
                if (typeof subscribeSuccessCallback === 'function') {
                    subscribeSuccessCallback(result);
                }
                this.emit('_subscribed', this.get());

                if (this._destroyed) {
                    this._subscribed = false;
                    return;
                }

                if (this._replicaOptions.allowWrite) {
                    this.subscribe((data: any, diff: any, context: any) => {
                        if (context.local) {
                            connection.send(`apply:${this.id}`, {data, changeRevision: this.changeRevision});
                        }
                    });
                }
            } else {
                console.error(`live-replica failed to subscribe remote path=${this.remotePath} reason=${result.rejectReason}`);
                if (typeof subscribeRejectCallback === 'function') {
                    subscribeRejectCallback(result.rejectReason);
                }
            }
        });

        this._subscribeInFlight = true;
    }

    async connect(connection: WebSocketClient | WebSocket | LiveReplicaSocket, remotePath: string, params?: object): Promise<any> {
        if (connection instanceof WebSocket) {
            connection = new WebSocketClient(connection);
        }

        if (!(connection instanceof WebSocketClient) && !(connection instanceof LiveReplicaSocket)) {
            throw new Error('Invalid connection type');
        }

        this.subscribeRemote(connection as LiveReplicaSocket, undefined, undefined);
        this.remotePath = remotePath;

        if (params) {
            this._replicaOptions.params = params;
        }

        return this.subscribed;
    }

    splice(patch: any, path?: string, options?: any): void {
        if (this._replicaOptions.allowWrite) {
            this._patchDiff.apply(patch, path, options ? {...options, ...LocalMutation} : LocalMutation);
        }
    }

    remove(path?: string, options?: any): void {
        if (this._replicaOptions.allowWrite) {
            this._patchDiff.apply({[path || '']: DeleteKeyword}, undefined, options ? {...options, ...LocalMutation} : LocalMutation);
        }
    }

    unsubscribeRemote(): void {
        if (!this._subscribed && !this._subscribeInFlight) {
            return;
        }

        if (this._connection && this.onApplyEvent) {
            this._connection.send(`unsubscribe:${this.id}`);
            this._connection.off(`apply:${this.id}`, this.onApplyEvent);
        }

        if (this._connection && this.onSocketReconnected) {
            this._connection.off('reconnect', this.onSocketReconnected);
        }

        this._subscribed = false;
        this._synced = false;
        this._subscribeInFlight = false;
    }

    destroy(): void {
        if (this._destroyed) {
            return;
        }

        this._destroyed = true;
        this.unsubscribeRemote();
        this.emit('destroyed');
        this._patchDiff.apply({}, undefined, { emitEvents: false });
    }

    get isReadOnly(): boolean {
        return !(this._replicaOptions?.allowWrite);
    }

    get subscribed(): Promise<any> {
        return new Promise((resolve) => {
            if (this._subscribed) {
                resolve(this.get());
            } else {
                this.once('_subscribed', resolve);
            }
        });
    }

    get synced(): Promise<any> {
        return new Promise((resolve) => {
            if (this._synced) {
                resolve(this.get());
            } else {
                this.once('_synced', resolve);
            }
        });
    }

    get replicaOptions(): ReplicaOptions {
        return this._replicaOptions;
    }

    set replicaOptions(value: ReplicaOptions) {
        this._replicaOptions = value;
    }
}

function replicaByProxy(proxy: any): Replica {
    if (!createProxy(proxy)) {
        throw new TypeError(`trying to connect a non LiveReplica Proxy type`);
    }

    const replica = proxy[deserializeFunctions];

    if (!(replica instanceof Replica)) {
        throw new TypeError(`trying to connect a non LiveReplica Replica type`);
    }

    return replica;
}

export async function connect(proxy: any, connection: WebSocketClient | WebSocket | LiveReplicaSocket, remotePath: string, params?: object): Promise<any> {
    const replica = replicaByProxy(proxy);
    return replica.connect(connection, remotePath, params);
}

export async function disconnect(proxy: any): Promise<any> {
    const replica = replicaByProxy(proxy);
    return replica.disconnect();
} 