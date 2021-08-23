import {extractBasePathAndProperty, replicaByData, concatPath} from "./utils.js";

const deferredDisconnections = new WeakMap();
export class LiveReplicaController {

    constructor(host) {
        this.host = host;
        host.addController(this);
        this._unwatchers = new Set();
    }

    watch(data, path, cb) {

        const {host, hostConnected} = this;
        let { replica, basePath } = replicaByData(data);
        let property;
        ({path, property} = extractBasePathAndProperty(path));

        path = concatPath(basePath, path);
        if (path) {
            replica = replica.at(path);
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