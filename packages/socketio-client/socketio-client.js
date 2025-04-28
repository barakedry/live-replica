import {LiveReplicaSocket} from '@live-replica/socket';
/**
 *  LiveReplicaSocketIoClient
 */
export class LiveReplicaSocketIoClient extends LiveReplicaSocket {

    // overrides
    isConnected() { return !!this._socket; }
}