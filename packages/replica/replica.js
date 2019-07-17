/**
 * Created by barakedry on 28/04/2018.
 */
'use strict';
const PatchDiff = require('../patch-diff');
const PatcherProxy = require('../proxy');
const LiveReplicaSocket = require('../socket');
const concatPath = PatchDiff.utils.concatPath;

let replicaId = 1000;

// privates
const deserializeFunctions  = Symbol('deserializeFunctions');
const createRPCfunction     = Symbol('createRPCfunction');
const remoteApply           = Symbol('remoteApply');
const remoteOverride           = Symbol('remoteOverride');
const bindToSocket           = Symbol('bindToSocket');

class Replica extends PatchDiff {

    // private
    [bindToSocket]() {

        this.connection.on(`apply:${this.id}`, (delta, meta = {}) => {
            if (delta && meta.snapshot) {
                this[remoteOverride](delta);
            } else {
                this[remoteApply](delta);
            }

            if (delta && !this._subscribed) {
                this._subscribed = true;
                this.emit('_subscribed', this.get());
            }
        });

        if (this.options.allowWrite) {
            this.subscribe((data, diff, options) => {
                if (options.local) {
                    this.connection.send(`apply:${this.id}`, data);
                }
            });
        }
    }

    [createRPCfunction](path) {
        const self = this;
        return function rpcToRemote(...args) {
            return new Promise((resolve) => {
                self.connection.send(`invokeRPC:${self.id}`, {path, args}, (returnValue) => {
                    resolve(returnValue);
                });
            });
        }
    }

    [deserializeFunctions](data, path) {

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

    [remoteApply](data) {
        super.apply(this[deserializeFunctions](data));
    }

    [remoteOverride](data) {
        super.set(this[deserializeFunctions](data));
    }

    // public
    constructor(remotePath, options = {dataObject: {}}) {

        options = Object.assign({
            allowWrite: false,
            allowRPC: false,
            subscribeRemoteOnCreate: !!options.connection
        }, options);

        super(options.dataObject || {}, options);
        this.remotePath = remotePath;
        this.id = ++replicaId;
        this.proxies = new WeakMap();

        if (this.options.subscribeRemoteOnCreate) {
            this.subscribeRemote(this.options.connection)
        }
    }

    subscribeRemote(connection = this.options.connection, connectionCallback = this.options.connectionCallback) {

        if (!(connection && connection instanceof LiveReplicaSocket)) {
            throw Error('undefined connection or not a LiveReplicaSocket');
        }

        this._subscribed = false;
        this.connection = connection;
        this[bindToSocket]();
        this.connection.send('subscribe', {
            id: this.id,
            path: this.remotePath,
            allowRPC: this.options.allowRPC,
            allowWrite: this.options.allowWrite
        }, (result) => {
            if (result.success) {
                console.info(`live-replica subscribed to remote path=${this.remotePath}`);
                if (typeof connectionCallback === 'function') {
                    connectionCallback(result);
                }
            } else {
                console.error(`live-replica failed to subscribe remote path=${this.remotePath} reason=${result.rejectReason}`);
            }
        });
    }

    apply(patch, path, options = {}) {
        if (this.options.allowWrite) {
            options.local = true;
            super.apply(patch, path, options);
        }
    }  

    set(fullDocument, path, options = {}) {
        if (this.options.allowWrite) {
            options.local = true;
            super.set(fullDocument, path, options);
        }
    }

    splice(patch, path, options = {}) {
        if (this.options.allowWrite) {
            options.local = true;
            super.apply(patch, path, options);
        }
    }

    remove(path, options = {}) {
        if (this.options.allowWrite) {
            options.local = true;
            super.remove(path, options);
        }
    }

    unsubscribeRemote() {
        if (!this.connection) { return; }
        this.connection.send(`unsubscribe:${this.id}`);
        delete this.connection;
    }


    destroy() {
        this.unsubscribeRemote();
        this.removeAllListeners();
    }

    get data() {
        if (!this.proxies.has(this)) {
            const proxy = PatcherProxy.create(this, '', null, !this.options.allowWrite);
            this.proxies.set(this, proxy);
        }
        return this.proxies.get(this);
    }

    get subscribed() {
        return new Promise((resolve) => {
            if (this._subscribed) {
                resolve(this.get());
            } else {
                this.once('_subscribed', resolve);
            }

        });
    }
}

Replica.prototype.override = Replica.prototype.set;

// export default Replica;
module.exports = Replica;