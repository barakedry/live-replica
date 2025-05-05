import { EventEmitter, EventListener } from '../events/events';
import { LiveReplicaSocket } from '../socket/socket';

let acks = 1;

/**
 * A LiveReplica socket implementation for MessageChannel communication
 * Allows direct communication between threads using MessagePort
 */
export class MessageChannelSocket extends LiveReplicaSocket {
    private _emitter: EventEmitter;
    private port?: MessagePort;
    private onPortMessage?: (event: MessageEvent) => void;

    /**
     * Creates a new MessageChannelSocket
     */
    constructor() {
        // @ts-expect-error: LiveReplicaSocket expects a baseSocket argument
        super();
        this._emitter = new EventEmitter();
        this._emitter.setMaxListeners(50000);
    }

    // Override base class methods

    protected _addSocketEventListener(eventName: string, fn: EventListener): void {
        this._emitter.on(eventName, fn);
    }

    protected _addSocketEventListenerOnce(eventName: string, fn: EventListener): void {
        this._emitter.once(eventName, fn);
    }

    protected _removeSocketEventListener(eventName: string, fn: EventListener): void {
        this._emitter.removeEventListener(eventName, fn);
    }

    protected _socketSend(eventName: string, payload: any, ack?: ((...args: any[]) => void) | undefined): Promise<any> {
        if (!this.port) {
            throw new Error('MessagePort not connected');
        }

        let ackEvent: string | undefined;
        if (ack) {
            ackEvent = `lr-acks::${++acks}`;
            this.once(ackEvent, ack);
        }

        const message = {
            liveReplica: {
                event,
                payload,
                ack: ackEvent,
            }
        };

        this.port.postMessage(message);
        return Promise.resolve();
    }

    // @ts-expect-error: baseSocket type mismatch with LiveReplicaSocket
    get baseSocket(): MessagePort | undefined {
        return this.port;
    }

    /**
     * Connects to a MessagePort
     * @param port The MessagePort to connect to
     */
    // @ts-expect-error: connect signature mismatch with LiveReplicaSocket
    connect(port: MessagePort): void {
        if (this.port === port) {
            return;
        }

        if (this.port && this.onPortMessage) {
            this.port.removeEventListener('message', this.onPortMessage);
        }

        this.port = port;

        this.onPortMessage = ({ data }: MessageEvent) => {
            if (data.liveReplica) {
                const { event, args } = data.liveReplica;
                this._emitter.emit(event, ...(args || []));
            }
        };

        this.port.addEventListener('message', this.onPortMessage);

        // Ensure the port is started
        if (port.start && typeof port.start === 'function') {
            port.start();
        }
    }

    /**
     * Disconnects from the MessagePort
     */
    disconnect(): void {
        // @ts-expect-error: send expects a payload argument
        this.send('disconnect');

        if (this.port && this.onPortMessage) {
            this.port.removeEventListener('message', this.onPortMessage);
        }

        delete this.port;
    }

    /**
     * Checks if the socket is connected
     * @returns True if connected, false otherwise
     */
    isConnected(): boolean {
        return !!this.port;
    }

    /**
     * Posts a raw message to the port
     * @param message The message to post
     * @param transfer Transferable objects to transfer
     */
    postMessage(message: any, transfer?: Transferable[]): void {
        if (!this.port) {
            throw new Error('MessagePort not connected');
        }

        if (transfer) {
            this.port.postMessage(message, transfer);
        } else {
            this.port.postMessage(message);
        }
    }
}

export default MessageChannelSocket; 