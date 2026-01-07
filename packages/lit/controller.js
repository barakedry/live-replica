import {extractBasePathAndProperty, replicaByData, concatPath} from "./utils.js";
import { isProxy, getPatchDiff, PatchDiff } from '@live-replica/client';

export const $all_observed_properties = new Set();
export const $observed_properties_watcher = new Set();

export function emitGlobalWatchers() {
    for (const fn of $observed_properties_watcher) {
        fn($all_observed_properties);
    }
}

function throttle(func, wait) {
    let timeout = null;
    let lastArgs = null;
    let lastThis = null;

    return function(...args) {
        if (!timeout) {
            // Fire immediately on first call
            func.apply(this, args);
            timeout = setTimeout(() => {
                timeout = null;
                if (lastArgs) {
                    func.apply(lastThis, lastArgs);
                    lastArgs = null;
                    lastThis = null;
                }
            }, wait);
        } else {
            // Store the latest arguments and context
            lastArgs = args;
            lastThis = this;
        }
    };
}
const deferredDisconnections = new WeakMap();
export class LiveReplicaController {

    constructor(host) {
        this.host = host;

        let selector = host.nodeName.toLowerCase();
        if (host.id) {
            selector += `#${host.id}`;
        }

        this._globalEntry = {element: host, controller: this, selector, propertyKey: '', replica: null};

        host.addController(this);
        this._unwatchers = new Set();

    }

    watch(data, path, cb, renderDelay = 0) {

        const {host, hostConnected} = this;

        let callRender = () => {
            if (hostConnected) {
                host.requestUpdate();
            }
        };

        if (renderDelay > 0) {
            callRender = throttle(callRender, renderDelay);
        }

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

        this._globalEntry.replica = replica;

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
                callRender();
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

        $all_observed_properties.add(this._globalEntry);
        emitGlobalWatchers();
    }

    hostDisconnected() {
        deferredDisconnections.set(this, setTimeout(() => {
            this._unwatchers.forEach(unsubscribe => unsubscribe());
            this._unwatchers.clear();
            $all_observed_properties.delete(this._globalEntry);
            delete this._globalEntry;
            emitGlobalWatchers();
        }, 0));
    }
}