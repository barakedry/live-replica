import { EventListener } from '../events/events';
import { LiveReplicaSocket } from '../socket/socket';
/**
 * A LiveReplica socket implementation for MessageChannel communication
 * Allows direct communication between threads using MessagePort
 */
export declare class MessageChannelSocket extends LiveReplicaSocket {
    private _emitter;
    private port?;
    private onPortMessage?;
    /**
     * Creates a new MessageChannelSocket
     */
    constructor();
    protected _addSocketEventListener(eventName: string, fn: EventListener): void;
    protected _addSocketEventListenerOnce(eventName: string, fn: EventListener): void;
    protected _removeSocketEventListener(eventName: string, fn: EventListener): void;
    protected _socketSend(eventName: string, payload: any, ack?: ((...args: any[]) => void) | undefined): Promise<any>;
    get baseSocket(): MessagePort | undefined;
    /**
     * Connects to a MessagePort
     * @param port The MessagePort to connect to
     */
    connect(port: MessagePort): void;
    /**
     * Disconnects from the MessagePort
     */
    disconnect(): void;
    /**
     * Checks if the socket is connected
     * @returns True if connected, false otherwise
     */
    isConnected(): boolean;
    /**
     * Posts a raw message to the port
     * @param message The message to post
     * @param transfer Transferable objects to transfer
     */
    postMessage(message: any, transfer?: Transferable[]): void;
}
export default MessageChannelSocket;
//# sourceMappingURL=message-channel-socket.d.ts.map