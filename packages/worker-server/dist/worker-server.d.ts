import { EventEmitter } from '../events/events';
import { LiveReplicaServer } from '../server/index';
declare class MessageChannelConnection extends EventEmitter {
    port: any;
    onMessage: ({ data }: {
        data: any;
    }) => void;
    constructor(port?: Window & typeof globalThis);
    send(event: string, ...args: any[]): void;
    emit(event: string, ...args: any[]): void;
    addEventListener(event: string, handler: EventListener): void;
    removeListener(event: string, handler: EventListener): void;
}
declare class WorkerConnection extends EventEmitter {
    worker: any;
    onMessage: ({ data }: {
        data: any;
    }) => void;
    constructor(worker: any);
    send(event: string, ...args: any[]): void;
    emit(event: string, ...args: any[]): void;
    addEventListener(event: string, handler: EventListener): void;
    removeListener(event: string, handler: EventListener): void;
}
export declare function createConnection(workerOrPort: any): MessageChannelConnection | WorkerConnection;
/**
 *  LiveReplicaWorkerSocket
 */
export declare class WorkerServer extends LiveReplicaServer {
    constructor(options: any);
}
export default WorkerServer;
//# sourceMappingURL=worker-server.d.ts.map