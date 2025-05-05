"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveReplicaController = void 0;
// @ts-nocheck
const utils_js_1 = require("./utils.js");
const client_1 = require("@live-replica/client");
function throttle(func, wait) {
    let timeout = null;
    let lastArgs = null;
    let lastThis = null;
    return function (...args) {
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
        }
        else {
            // Store the latest arguments and context
            lastArgs = args;
            lastThis = this;
        }
    };
}
const deferredDisconnections = new WeakMap();
class LiveReplicaController {
    constructor(host) {
        this.host = host;
        host.addController(this);
        this._unwatchers = new Set();
    }
    watch(data, path, cb, renderDelay = 0) {
        const { host, hostConnected } = this;
        let callRender = () => {
            if (hostConnected) {
                host.requestUpdate();
            }
        };
        if (renderDelay > 0) {
            callRender = throttle(callRender, renderDelay);
        }
        let replica;
        if (data instanceof client_1.PatchDiff) {
            replica = data;
        }
        else if ((0, client_1.isProxy)(data)) {
            replica = (0, client_1.getPatchDiff)(data);
        }
        else {
            throw new Error('watch can only be used with a LiveReplica Proxy, Replica or PatchDiff instance');
        }
        let property;
        if (path) {
            ({ path, property } = (0, utils_js_1.extractBasePathAndProperty)(path));
            if (path) {
                replica = replica.at(path);
            }
        }
        const deleteKeyword = replica.options.deleteKeyword;
        let unsubscribe = replica.subscribe(function (patch, diff) {
            const selfDelete = patch === deleteKeyword;
            if (selfDelete) {
                patch = undefined;
            }
            let lengthChanged = property === 'length' && (diff.hasAdditions || diff.hasDeletions);
            if (!lengthChanged && (property && !patch?.[property])) {
                return;
            }
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
    }
    hostDisconnected() {
        deferredDisconnections.set(this, setTimeout(() => {
            this._unwatchers.forEach(unsubscribe => unsubscribe());
            this._unwatchers.clear();
        }, 0));
    }
}
exports.LiveReplicaController = LiveReplicaController;
//# sourceMappingURL=controller.js.map