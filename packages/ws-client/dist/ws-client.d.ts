import { LiveReplicaSocket } from '../socket/socket';
declare const onMessage: unique symbol;
export declare class WebSocketClient extends LiveReplicaSocket {
    protected _socket: any;
    protected _emitter: any;
    protected [onMessage]: any;
    constructor(socket?: any);
    protected _addSocketEventListener(eventName: string, fn: (...args: any[]) => void): void;
    protected _addSocketEventListenerOnce(eventName: string, fn: (...args: any[]) => void): void;
    _removeSocketEventListener(eventName: string, fn: (...args: any[]) => void): void;
    protected _socketSend(eventName: string, payload: any, ack?: (...args: any[]) => void): Promise<any>;
    set socket(socket: any);
    get socket(): any;
    get baseSocket(): any;
    disconnect(): void;
    isConnected(): boolean;
}
export default WebSocketClient;
//# sourceMappingURL=ws-client.d.ts.map