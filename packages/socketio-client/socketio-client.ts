import { LiveReplicaSocket } from '../socket/socket';

/**
 *  LiveReplicaSocketIoClient
 */
export class LiveReplicaSocketIoClient extends LiveReplicaSocket {
    // overrides
    isConnected(): boolean { return !!this.baseSocket; }
} 