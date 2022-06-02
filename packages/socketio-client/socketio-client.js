import {LiveReplicaSocket} from '../socket/socket.js';
/**
 *  LiveReplicaSocketIoClient
 */
export class LiveReplicaSocketIoClient extends LiveReplicaSocket {

    // overrides
    isConnected() { return !!this._socket; }
}