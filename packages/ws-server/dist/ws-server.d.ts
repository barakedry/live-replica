import { LiveReplicaServer } from '../server/index.js';
/**
 *  LiveReplicaWorkerSocket
 */
export declare class LiveReplicaWebSocketsServer extends LiveReplicaServer {
    constructor(wsServer: any, options?: any);
    handleWebSocket(socket: any): () => void;
}
export default LiveReplicaWebSocketsServer;
//# sourceMappingURL=ws-server.d.ts.map