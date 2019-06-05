/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const LiveReplicaSocket = require('../socket');
/**
 *  LiveReplicaSocketIoClient
 */
class LiveReplicaSocketIoClient extends LiveReplicaSocket {

    // overrides
    isConnected() { return !!this._socket; }
}

module.exports = LiveReplicaSocketIoClient;