/**
 * Created by barakedry on 28/04/2018.
 */
'use strict';
import PatchDiff from '@live-replica/patch-diff';
import PatcherProxy from '@live-replica/proxy';
import LiveReplicaConnection from '@live-replica/socket';

class Replica extends PatchDiff {

    constructor(remotePath, options = {}) {
        super();
        this.remotePath = remotePath;
        this.options = Object.assign({
            readonly: true,
            subscribeRemoteOnCreate: !!options.connection
        }, options);

        if (this.options.readonly === false) {
            this.proxies = new WeakMap();
        }

        if (this.options.connectOnCreate) {
            this.connect(this.options.connection)
        }
    }

    subscribeRemote(connection = this.options.connection) {

        if (!(connetion && connection instanceof LiveReplicaSocket)) {
            throw Error('undefined connection or not a LiveReplicaSocket');
        }

        this.connection = connection;
        this.connection.send('subscribe');
    }

    unsubscribeRemote() {
        this.connection.send('unsubscribe');
    }


    destroy() {

        this.removeAllListeners();
        this.unsubscribeRemote();

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