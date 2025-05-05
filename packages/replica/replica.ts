import { PatchDiff } from "@live-replica/patch-diff";
import { LiveReplicaSocket } from '../socket/socket';
import { isProxy, getPatchDiff } from '../proxy/proxy';
import { Utils } from '../utils/utils';
import { WebSocketClient } from "../ws-client/ws-client";
const { concatPath } = Utils;

export type LiveReplicaProxy<T = any> = T & object;

function generateUniqueId() {
    const timestamp = Date.now().toString(36); // Base36 encoding of the current timestamp
    const randomPart = Math.random().toString(36).substring(2, 15); // Random part

    return `${timestamp}-${randomPart}`;
}

// privates
const deserializeFunctions = Symbol('deserializeFunctions');
const createRPCfunction = Symbol('createRPCfunction');
const remoteApply = Symbol('remoteApply');
const remoteOverride = Symbol('remoteOverride');
const bindToSocket = Symbol('bindToSocket');

const LocalMutation = { context: { local: true } };
// lock localMutation
Object.freeze(LocalMutation);

export default class Replica extends PatchDiff {
    changeRevision!: number;
    onApplyEvent: any;
    onSocketReconnected: any;
    _synced!: boolean;
    _subscribed!: boolean;
    _subscribeInFlight!: boolean;
    _destroyed!: boolean;
    _connection: any;
    id!: string;
    remotePath!: string;
    _path: any;
    _wrapper: any;
    _wrapperInner: any;
    _wrapperKey: any;
    options: any;

    // private
    [bindToSocket]() {
        this.changeRevision = 0;
        this.onApplyEvent = (delta: any, meta: any = {}) => {
            if (meta.snapshot || meta.displace) {
                this[remoteOverride](delta);
            } else {
                this.changeRevision = meta.changeRevision;
                const applyOptions = meta.deletePatch ? { deletePatch: true } : undefined;
                this[remoteApply](delta, applyOptions);
            }
            if (!this._synced) {
                this._synced = true;
                this.emit('_synced', this.get());
            }
        };
        this.connection.on(`apply:${this.id}`, this.onApplyEvent);
    }

    [createRPCfunction](path: any) {
        const self = this;
        return function rpcToRemote(...args: any[]) {
            return new Promise((resolve, reject) => {
                self.connection.send(`invokeRPC:${self.id}`, { path, args }, (returnValue: any) => {
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

    [deserializeFunctions](data: any, path: any) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }

        const keys = Object.keys(data);
        for (let i = 0, l = keys.length; i < l; i++) {
            const key = keys[i];
            const value = data[key];

            if (value === 'function()') {
                data[key] = this[createRPCfunction](concatPath(path, key)!);
            } if (typeof value === 'object' && value !== null) {
                this[deserializeFunctions](value, concatPath(path, key)!);
            }
        }
        return data;
    }

    [remoteApply](data: any, options: any) {
        // @ts-expect-error
        super.apply(this[deserializeFunctions](data), undefined, options);
    }

    [remoteOverride](data: any) {
        // @ts-expect-error
        super.set(this[deserializeFunctions](data), undefined);
    }

    // public
    constructor(remotePath: any, options: any = { dataObject: {} }) {
        options = Object.assign({
            subscribeRemoteOnCreate: !!options.connection
        }, options);
        super({}, options);
        this._path = '$remote';
        this._wrapper = {};
        this._wrapperInner = this._wrapper;
        this._wrapperKey = '$remote';
        if (options.dataObject) {
            super.set(options.dataObject);
        }
        this.remotePath = remotePath;
        this.id = generateUniqueId();
        this._synced = false;
        this._subscribed = false;
        this.options = options;
        if (this.options.subscribeRemoteOnCreate) {
            this.subscribeRemote(this.options.connection)
        }
    }

    set connection(connection: any) {
        if (connection) {
            if (this._destroyed) {
                throw Error('replica is destroyed');
            }
        }
        if (this._connection) {
            this._connection.off(`apply:${this.id}`, this.onApplyEvent);
            this._connection.off('reconnect', this.onSocketReconnected);
        }
        this._connection = connection;
    }

    get connection() {
        return this._connection;
    }

    subscribeRemote(
        connection: any = this.options.connection,
        subscribeSuccessCallback: any = this.options.subscribeSuccessCallback,
        subscribeRejectCallback: any = this.options.subscribeRejectCallback
    ) {
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
        this.connection.send('subscribe', {
            id: this.id,
            path: this.remotePath,
            allowRPC: this.options.allowRPC,
            allowWrite: this.options.allowWrite,
            params: this.options.params
        }, (result: any) => {
            this._subscribeInFlight = false;
            if (result.success) {
                console.info(`live-replica subscribed to remote path=${this.remotePath} writable=${result.writable} rpc=${result.rpc}`);
                this.options.allowWrite = result.writable;
                this._subscribed = true;
                if (typeof subscribeSuccessCallback === 'function') {
                    subscribeSuccessCallback(result);
                }
                super.emit('_subscribed', this.get());
                if (this._destroyed) {
                    this._subscribed = false;
                    return;
                }
                if (this.options.allowWrite) {
                    this.subscribe((data: any, diff: any, context: any) => {
                        if (context.local) {
                            this.connection.send(`apply:${this.id}`, { data, changeRevision: this.changeRevision });
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

    async connect<T>(connection: any, remotePath: any, params: any): Promise<{
        writable: boolean;
        rpc: boolean;
    }> {
        if (this._destroyed) {
            throw Error('replica is destroyed');
        }
        if (connection instanceof WebSocket) {
            connection = new WebSocketClient(connection);
        }
        return new Promise((resolve, reject) => {
            this.remotePath = remotePath;
            this.options.params = params;
            this.subscribeRemote(connection, resolve, reject);
        });
    }

    apply(patch: any, path?: any, options?: any) {
        if (this.options.allowWrite) {
            super.apply(patch, path, options ? { ...options, ...LocalMutation } : LocalMutation);
        }
    }

    set(fullDocument: any, path?: any, options?: any) {
        if (this.options.allowWrite) {
            super.set(fullDocument, path, options ? { ...options, ...LocalMutation } : LocalMutation);
        }
    }

    splice(patch: any, path?: any, options?: any) {
        if (this.options.allowWrite) {
            super.splice(patch, path, options ? { ...options, ...LocalMutation } : LocalMutation);
        }
    }

    remove(path: any, options?: any) {
        if (this.options.allowWrite) {
            super.remove(path, options ? { ...options, ...LocalMutation } : LocalMutation);
        }
        return undefined;
    }

    unsubscribeRemote() {
        if (!this.connection) { return; }

        if (!this._subscribed && !this._subscribeInFlight) {
            console.warn('unsubscribeRemote called on an already unsubscribed replica');
            return;
        }

        const promise = this.connection.send(`unsubscribe:${this.id}`);
        this._subscribed = false;
        this._synced = false;
        return promise;
    }

    destroy() {
        this.unsubscribeRemote();
        this.destroyProxy();
        if (this.connection) {
            this.connection = undefined;
        }
        this.emit('destroyed');
        this._destroyed = true;
        // @ts-expect-error
        this.removeAllListeners();
    }

    get isReadOnly() {
        return !(this.options?.allowWrite)
    }

    get subscribed() {
        if (this._subscribed) {
            return Promise.resolve(this.get());
        }
        return new Promise((resolve) => super.once('_subscribed', resolve,
            // @ts-expect-error
            false));
    }

    get synced() {
        if (this._synced) {
            return Promise.resolve(this.get());
        }
        return new Promise((resolve) => this.once('_synced', resolve,
            // @ts-expect-error
            false));
    }
}

// @ts-expect-error
Replica.prototype.override = Replica.prototype.set;
// @ts-expect-error
Replica.prototype.disconnect = Replica.prototype.unsubscribeRemote;

// @ts-expect-error
Replica.create = function create(initData: any = {}, options: any = {}) {
    const replica = new Replica('', { dataObject: initData, ...options });
    return replica.data;
};

function replicaByProxy(proxy: any) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to connect a non LiveReplica Proxy type`);
    }
    const replica = getPatchDiff(proxy);
    if (!(replica instanceof Replica)) {
        throw new TypeError(`trying to connect a non LiveReplica Replica type`);
    }
    return replica;
}

// functional interface (passing proxy)

export async function connect<T>(proxy: LiveReplicaProxy<T>, connection: any, remotePath: any, params: any): Promise<{
    writable: boolean;
    rpc: boolean;
}> {
    const replica = replicaByProxy(proxy);
    return replica.connect(connection, remotePath, params);
}

export async function disconnect<T>(proxy: LiveReplicaProxy<T>): Promise<any> {
    const replica = replicaByProxy(proxy);
    // @ts-expect-error
    return replica.disconnect();
}