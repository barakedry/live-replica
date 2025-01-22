import {extractBasePathAndProperty, replicaByData, concatPath} from "./utils.js";
import { isProxy, getPatchDiff, PatchDiff } from '@live-replica/client';

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

        if (data instanceof PatchDiff) {
            replica = data;
        } else if (isProxy(data)) {
            replica = getPatchDiff(data);
        } else {
            throw new Error('watch can only be used with a LiveReplica Proxy, Replica or PatchDiff instance');
        }

        let property;
        if (path) {
            ({path, property} = extractBasePathAndProperty(path));

            if (path) {
                replica = replica.at(path);
            }
        }

        const deleteKeyword = replica.options.deleteKeyword;
        let unsubscribe = replica.subscribe(function (patch, diff) {

            const selfDelete = patch === deleteKeyword;
            if (selfDelete)  {
                patch = undefined;
            }

            let lengthChanged = property === 'length' && (diff.hasAdditions || diff.hasDeletions);

            if (!lengthChanged && (property && !patch?.[property])) { return; }

            let doRender = true;

            if (cb) {
                const cbReturn = cb.call(host, patch, diff, replica.get(property), selfDelete);
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

        if (data instanceof PatchDiff) {
            replica = data;
        } else if (isProxy(data)) {
            replica = getPatchDiff(data);
        } else {
            throw new Error('watch can only be used with a LiveReplica Proxy, Replica or PatchDiff instance');
        }


        let property;
        if (path) {
            ({path, property} = extractBasePathAndProperty(path));

            if (path) {
                replica = replica.at(path);
            }
        }

        const deleteKeyword = replica.options.deleteKeyword;
        let unsubscribe = replica.subscribe(function (patch, diff) {

            const selfDelete = patch === deleteKeyword;
            if (selfDelete)  {
                patch = undefined;
            }

            let lengthChanged = property === 'length' && (diff.hasAdditions || diff.hasDeletions);

            if (!lengthChanged && (property && !patch?.[property])) { return; }

            let doRender = true;

            if (cb) {
                const cbReturn = cb.call(host, patch, diff, replica.get(property), selfDelete);
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