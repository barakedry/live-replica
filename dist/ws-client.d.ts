import { LiveReplicaSocket } from '../socket/socket';
declare const onMessage: unique symbol;
export declare class WebSocketClient extends LiveReplicaSocket {
    _emitter: any;
    _socket: any;
    [onMessage]: any;
    constructor(socket?: any);
    _addSocketEventListener(eventName: string, fn: (...args: any[]) => void): void;
    _addSocketEventListenerOnce(eventName: string, fn: (...args: any[]) => void): void;
    _removeSocketEventListener(eventName: string, fn: (...args: any[]) => void): void;
    _socketSend(event: string, payload: any, ack?: (...args: any[]) => void): void;
    set socket(socket: any);
    get socket(): any;
    get baseSocket(): any;
    disconnect(): void;
    isConnected(): boolean;
}
export default WebSocketClient;
//# sourceMappingURL=ws-client.d.ts.map