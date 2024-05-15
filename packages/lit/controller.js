import {extractBasePathAndProperty, replicaByData, concatPath} from "./utils.js";
import { isProxy, getPatchDiff, Replica } from '@live-replica/client';

const deferredDisconnections = new WeakMap();
export class LiveReplicaController {

    constructor(host) {
        this.host = host;
        host.addController(this);
        this._unwatchers = new Set();
    }

    watch(data, path, cb) {

        const {host, hostConnected} = this;

        let replica;

        if (data instanceof Replica) {
            replica = data;
        } if (isProxy(data)) {
            replica = getPatchDiff(data);
        } else {
            throw new Error('watch can only be used with a LiveReplica Proxy or Replica instance');
        }

        let property;
        if (path) {
            ({path, property} = extractBasePathAndProperty(path));

            if (path) {
                replica = replica.at(path);
            }
        }

        let unsubscribe = replica.subscribe(function (patch, diff) {

            let lengthChanged = property === 'length' && (diff.hasAdditions || diff.hasDeletions);

            if (!lengthChanged && (property && !patch[property])) { return; }

            let doRender = true;

            if (cb) {
                const cbReturn = cb.call(host, patch, diff, replica.get(property));
                if (cbReturn === false) {
                    doRender = false;
                }
            }

            if (doRender) {
                host.requestUpdate();
            }
        });

        const unwatch = () => {
            if (unsubscribe) {
                unsubscribe();
                console.log('unsubscribed', path);
                unsubscribe = null;
            }
            this._unwatchers.delete(unwatch);
        };

        this._unwatchers.add(unwatch);

        return unwatch;
    }

    hostConnected() {
        this.host.requestUpdate();
        if (deferredDisconnections.has(this)) {
            clearTimeout(deferredDisconnections.get(this));
            deferredDisconnections.delete(this);
        }
    }

    hostDisconnected() {
        deferredDisconnections.set(this, setTimeout(() => {
            this._unwatchers.forEach(unsubscribe => unsubscribe());
            this._unwatchers.clear();
        }, 0));
    }
}

export class WatchController {

    constructor(host, proxyOrReplica, path, options) {
        this.host = host;
        host.addController(this);
        this._unwatch = this._watch(proxy, proxyOrReplica, options);
    }

    _watch(data, path, cb) {

        const {host} = this;

        let replica;

        if (data instanceof Replica) {
            replica = data;
        } if (isProxy(data)) {
            replica = getPatchDiff(data);
        } else {
            throw new Error('watch can only be used with a LiveReplica Proxy or Replica instance');
        }

        let property;
        if (path) {
            ({path, property} = extractBasePathAndProperty(path));

            if (path) {
                replica = replica.at(path);
            }
        }

        let unsubscribe = replica.subscribe(function (patch, diff) {

            let lengthChanged = property === 'length' && (diff.hasAdditions || diff.hasDeletions);

            if (!lengthChanged && (property && !patch[property])) { return; }

            let doRender = true;

            if (cb) {
                const cbReturn = cb.call(host, patch, diff, replica.get(property));
                if (cbReturn === false) {
                    doRender = false;
                }
            }

            if (doRender) {
                host.requestUpdate();
            }
        });

        return function unwatch() {
            if (unsubscribe) {
                unsubscribe();
                console.log('unsubscribed', path);
                unsubscribe = null;
            }
            delete this._unwatch
        };
    }

    hostConnected() {
        this.host.requestUpdate();
        if (deferredDisconnections.has(this)) {
            clearTimeout(deferredDisconnections.get(this));
            deferredDisconnections.delete(this);
        }
    }

    hostDisconnected() {
        deferredDisconnections.set(this, setTimeout(() => {
            this._unwatch?.();
        }, 0));
    }
}