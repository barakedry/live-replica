export interface BaseSocket {
    on(event: string, fn: (...args: any[]) => void): void;
    once(event: string, fn: (...args: any[]) => void): void;
    removeListener(event: string, fn: (...args: any[]) => void): void;
    emit(event: string, payload: any, ack?: (...args: any[]) => void): void;
    connect?(): void;
    disconnect?(): void;
}
export declare class LiveReplicaSocket {
    private _socket;
    private _instance;
    static instances: number;
    constructor(baseSocket: BaseSocket);
    send(event: string, payload: any, ack?: (...args: any[]) => void): Promise<any>;
    on(event: string, fn: (...args: any[]) => void): void;
    once(event: string, fn: (...args: any[]) => void): void;
    off(event: string, fn: (...args: any[]) => void): void;
    /**
     * Overrides
     */
    get baseSocket(): BaseSocket;
    private _addSocketEventListener;
    private _addSocketEventListenerOnce;
    private _removeSocketEventListener;
    private _socketSend;
    connect(baseSocket: BaseSocket): void;
    disconnect(): void;
    isConnected(): boolean;
}
export default LiveReplicaSocket;
//# sourceMappingURL=socket.d.ts.map