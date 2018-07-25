/**
 * Created by barakedry on 28/04/2018.
 */
'use strict';
// import PatchDiff from '@live-replica/patch-diff';
// import PatcherProxy from '@live-replica/proxy';
// import LiveReplicaConnection from '@live-replica/socket';

const PatchDiff = require('@live-replica/patch-diff');
const PatcherProxy = require('@live-replica/proxy');
const LiveReplicaConnection = require('@live-replica/socket');

class Replica extends PatchDiff {

    constructor(remotePath, options = {dataObject: {}}) {

        options = Object.assign({
            readonly: true,
            subscribeRemoteOnCreate: !!options.connection
        }, options);

        super(options.dataObject || {}, options);
        this.remotePath = remotePath;
        this.proxies = new WeakMap();

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
        if (!this.proxies.has(this)) {
            const proxy = PatcherProxy.create(this, '', null, this.options.readonly);
            this.proxies.set(this, proxy);
        }
        return this.proxies.get(this);
    }
}

// export default Replica;
module.exports = Replica;