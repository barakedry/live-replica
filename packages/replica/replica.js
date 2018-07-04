/**
 * Created by barakedry on 28/04/2018.
 */
'use strict';
import PatchDiff from '@live-replica/patch-diff';
import PatcherProxy from '@live-replica/proxy';

class Replica extends PatchDiff {

    constructor(remotePath, options = {}) {
        super();
        this.remotePath = remotePath;
        this.options = Object.assign({
            readonly: true,
        }, options);

        if (this.options.readonly === false) {
            this.proxies = new WeakMap();
        }
    }

    connect(connection) {

    }

    disconnect() {

    }


    destroy() {

        this.removeAllListeners();
        this.disconnect();

    }

    get data() {
        if (this.options.readonly) {
            return this._data;
        } else {
            if (!this.proxies.has(this)) {
                const proxy = new PatcherProxy(this);
                this.proxies.set(this, proxy);
            }
            return this.proxies.get(this);
        }
    }
}

export default Replica;