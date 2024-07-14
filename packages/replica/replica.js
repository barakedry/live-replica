import { PatchDiff } from "../patch-diff/index.js";
import { LiveReplicaSocket } from '../socket/socket.js';
import { isProxy, getPatchDiff } from '../proxy/proxy.js';
import { Utils } from '../utils/utils.js';
import {WebSocketClient} from "../ws-client/ws-client.js";
const { concatPath } = Utils;

function generateUniqueId() {
    const timestamp = Date.now().toString(36); // Base36 encoding of the current timestamp
    const randomPart = Math.random().toString(36).substring(2, 15); // Random part

    return `${timestamp}-${randomPart}`;
}

// privates
const deserializeFunctions  = Symbol('deserializeFunctions');
const createRPCfunction     = Symbol('createRPCfunction');
const remoteApply           = Symbol('remoteApply');
const remoteOverride        = Symbol('remoteOverride');
const bindToSocket          = Symbol('bindToSocket');

const LocalMutation = {context: {local: true}};
// lock localMutation
Object.freeze(LocalMutation);

export class Replica extends PatchDiff {

    // private
    [bindToSocket]() {

        this.changeRevision = 0;
        this.onApplyEvent = (delta, meta = {}) => {
            if (meta.snapshot) {
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

        this.connection.on(`apply:${this.id}`, this.onApplyEvent);
    }

    [createRPCfunction](path) {
        const self = this;
        return function rpcToRemote(...args) {
            return new Promise((resolve, reject) => {
                self.connection.send(`invokeRPC:${self.id}`, {path, args}, (returnValue) => {
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

    [deserializeFunctions](data, path) {

        if (typeof data !== 'object' || data === null) {
            return data;
        }

        const keys = Object.keys(data);
        for (let i = 0, l = keys.length; i < l; i++) {
            const key = keys[i];
            const value = data[key];

            if (value === 'function()') {
                data[key] = this[createRPCfunction](concatPath(path, key));
            } if (typeof value === 'object' && value !== null) {
                this[deserializeFunctions](value, concatPath(path, key));
            }
        }
        return data;
    }

    [remoteApply](data, options) {
        super.apply(this[deserializeFunctions](data), options);
    }

    [remoteOverride](data) {
        super.set(this[deserializeFunctions](data));
    }

    // public
    constructor(remotePath, options = {dataObject: {}}) {

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

        if (this.options.subscribeRemoteOnCreate) {
            this.subscribeRemote(this.options.connection)
        }
    }

    subscribeRemote(connection = this.options.connection, subscribeSuccessCallback = this.options.subscribeSuccessCallback, subscribeRejectCallback = this.options.subscribeRejectCallback) {

        if (!(connection && connection instanceof LiveReplicaSocket)) {
            throw Error('undefined connection or not a LiveReplicaSocket');
        }

        this._subscribed = false;
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
        }, (result) => {
            if (result.success) {
                console.info(`live-replica subscribed to remote path=${this.remotePath} writable=${result.writable} rpc=${result.rpc}`);
                this.options.allowWrite = result.writable;

                this._subscribed = true;

                if (typeof subscribeSuccessCallback === 'function') {
                    subscribeSuccessCallback(result);
                }
                super.emit('_subscribed', this.get());

                if (this.options.allowWrite) {
                    this.subscribe((data, diff, context) => {
                        if (context.local) {
                            this.connection.send(`apply:${this.id}`, {data, changeRevision: this.changeRevision});
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
    }

    async connect(connection, remotePath, params) {
        if (connection instanceof WebSocket)  {
            connection = new WebSocketClient(connection);
        }

        return new Promise((resolve, reject) => {
            this.remotePath = remotePath;
            this.options.params = params;
            this.subscribeRemote(connection, resolve, reject);
        });
    }

    apply(patch, path, options) {
        if (this.options.allowWrite) {
            super.apply(patch, path, options ? {...options, ...LocalMutation} : LocalMutation);
        }
    }

    set(fullDocument, path, options) {
        if (this.options.allowWrite) {
            super.set(fullDocument, path, options ? {...options, ...LocalMutation} : LocalMutation);
        }
    }

    splice(patch, path, options) {
        if (this.options.allowWrite) {
            super.splice(patch, path, options ? {...options, ...LocalMutation} : LocalMutation);
        }
    }

    remove(path, options) {
        if (this.options.allowWrite) {
            super.remove(path, options ? {...options, ...LocalMutation} : LocalMutation);
        }
    }

    unsubscribeRemote() {
        if (!this.connection) { return; }
        if (!this._subscribed) { return; }
        const promise = this.connection.send(`unsubscribe:${this.id}`);
        this._subscribed = false;
        this._synced = false;
        return promise;
    }


    destroy() {
        this.unsubscribeRemote();
        this.removeAllListeners();

        if (this.connection) {
            this.connection.off(`apply:${this.id}`, this.onApplyEvent);
            this.connection.off('reconnect', this.onSocketReconnected);
            delete this.connection;
        }

        this.destroyProxy();

        this.emit('destroyed');
    }

    get isReadOnly() {
        return !(this.options?.allowWrite)
    }

    get subscribed() {
        if (this._subscribed) {
            return Promise.resolve(this.get());
        }

        return new Promise((resolve) => super.once('_subscribed', resolve, false));
    }

    get synced() {
        if (this._synced) {
            return Promise.resolve(this.get());
        }

        return new Promise((resolve) => this.once('_synced', resolve, false));
    }
}

Replica.prototype.override = Replica.prototype.set;
Replica.prototype.disconnect = Replica.prototype.unsubscribeRemote;

Replica.create = function create(initData = {}, options = {}) {
    const replica = new Replica('', {dataObject: initData, ...options});
    return replica.data;
};

function replicaByProxy(proxy) {
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

export async function connect(proxy, connection, remotePath, params) {
    const replica = replicaByProxy(proxy);
    return replica.connect(connection, remotePath, params);
}

export async function disconnect(proxy) {
    const replica = replicaByProxy(proxy);
    return replica.disconnect();
}

export default Replica;