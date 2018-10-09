/**
 * Created by barakedry on 28/04/2018.
 */
'use strict';
const PatchDiff = require('@live-replica/patch-diff');
const PatcherProxy = require('@live-replica/proxy');
const LiveReplicaSocket = require('@live-replica/socket');
const concatPath = PatchDiff.utils.concatPath;

let replicaId = 1000;
class Replica extends PatchDiff {

    constructor(remotePath, options = {dataObject: {}}) {

        options = Object.assign({
            readonly: true,
            subscribeRemoteOnCreate: !!options.connection
        }, options);

        super(options.dataObject || {}, options);
        this.remotePath = remotePath;
        this.id = ++replicaId;
        this.proxies = new WeakMap();

        if (!this.options.connectionCallback) {
            this.options.connectionCallback = (result) => {
                if (result.success) {
                    console.info(`live-replica subscribed to remote ${this.options.readonly ? 'readonly': ''} path=${this.remotePath}`);
                } else {
                    console.error(`live-replica failed to subscribe remote ${this.options.readonly ? 'readonly': ''} path=${this.remotePath} reason=${result.reason}`);
                }
            };
        }

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
        this._bindToSocket();
        this.connection.send('subscribe', {
            id: this.id,
            path: this.remotePath,
            allowRPC: !this.options.readonly || this.options.allowRPC,
            allowWrite: !this.options.readonly
        }, connectionCallback);
    }

    _bindToSocket() {

        this.connection.on(`apply:${this.id}`, (delta) => {
            this._remoteApply(delta);
            if (delta && !this._subscribed) {
                this._subscribed = true;
                this.emit('_subscribed', this.get());
            }
        });

        if (this.options.readonly === false) {
            this.subscribe((data, diff, options) => {
                if (options.local) {
                    this.connection.send(`apply:${this.id}`, data);
                }
            });
        }
    }

    _createRPCfunction(path) {
        return function rpcToRemote(...args) {
            new Promise((resolve) => {
                this.connection.send(`invokeRPC:${this.id}`, path, args, resolve);
            });
        }
    }

    _deserialzeFunctions(data, path) {

        const keys = Object.keys(data);
        for (let i = 0, l = keys.length; i < l; i++) {
            const key = keys[i];
            const value = data[key];

            if (value === 'function()') {
                data[key] = this._createRPCfunction(concatPath(path, key));
            } if (typeof value === 'object' && value !== null) {
                this._deserialzeFunctions(value, concatPath(path, key));
            }
        }
        return data;
    }

    _remoteApply(data) {
        super.apply(this._deserialzeFunctions(data));
    }

    apply(...args) {
        if (this.options.readonly === false) {
            if (args.length === 3) {
                args[2].local = true;
            } else {
                args.push({local: true});
            }
            super.apply(...args);
        }
    }

    unsubscribeRemote() {
        this.connection.send(`unsubscribe:${this.id}`);
    }


    destroy() {

        this.removeAllListeners();
        this.unsubscribeRemote();

    }

    getWhenExists(path) {
        return new Promise(resolve => {
            this.get(path, resolve);
        });
    }

    get existance() {
        return this.getWhenExists();
    }

    get data() {
        if (!this.proxies.has(this)) {
            const proxy = PatcherProxy.create(this, '', null, this.options.readonly);
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

// export default Replica;
module.exports = Replica;