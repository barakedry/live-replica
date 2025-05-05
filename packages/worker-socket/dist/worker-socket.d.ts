import { LiveReplicaSocket } from '../socket/socket';
export declare class WorkerSocket extends LiveReplicaSocket {
    _emitter: any;
    worker: any;
    onWorkerMessage: any;
    previuslySetTerminate: any;
    socket: any;
    constructor();
    _addSocketEventListener(eventName: string, fn: (...args: any[]) => void): void;
    _addSocketEventListenerOnce(eventName: string, fn: (...args: any[]) => void): void;
    _removeSocketEventListener(eventName: string, fn: (...args: any[]) => void): void;
    _socketSend(event: string, payload: any, ack?: (...args: any[]) => void): void;
    get baseSocket(): any;
    connect(worker: any): void;
    disconnect(): void;
    isConnected(): boolean;
}
export default WorkerSocket;
//# sourceMappingURL=worker-socket.d.ts.map