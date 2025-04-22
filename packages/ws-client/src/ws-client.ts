import { EventEmitter } from '@live-replica/events';
import { LiveReplicaSocket, BaseSocket } from '@live-replica/socket';
import { encode, decode } from '@msgpack/msgpack';

const LIVE_REPLICA_MSG = '$LR';
const onMessage = Symbol('onWebsocketMessage');
let acks = Date.now();
const nativeSocketEvents: Record<string, string> = {'disconnect': 'close'};

interface LiveReplicaMessage {
    [LIVE_REPLICA_MSG]: {
        event: string;
        payload?: any;
        args?: any[];
        ack?: string;
    };
}

class WebSocketAdapter implements BaseSocket {
    constructor(private ws: WebSocket) {}

    on(event: string, fn: (...args: any[]) => void): void {
        this.ws.addEventListener(event, fn as any);
    }

    once(event: string, fn: (...args: any[]) => void): void {
        const once = (...args: any[]) => {
            this.ws.removeEventListener(event, once as any);
            fn(...args);
        };
        this.ws.addEventListener(event, once as any);
    }

    removeListener(event: string, fn: (...args: any[]) => void): void {
        this.ws.removeEventListener(event, fn as any);
    }

    emit(event: string, payload: any, ack?: (...args: any[]) => void): void {
        const message: LiveReplicaMessage = {
            [LIVE_REPLICA_MSG]: {
                event,
                payload,
                ack: ack ? `lr-acks::${++acks}` : undefined,
            }
        };
        this.ws.send(encode(message));
    }

    connect(): void {
        // WebSocket is already connected when created
    }

    disconnect(): void {
        this.ws.close();
    }
}

export class WebSocketClient extends LiveReplicaSocket {
    private _webSocket?: WebSocket;
    private _emitter: EventEmitter;
    private [onMessage]?: (event: MessageEvent) => void;
    private _adapter?: WebSocketAdapter;

    constructor(socket?: WebSocket) {
        const adapter = new WebSocketAdapter(new WebSocket(''));
        super(adapter);
        this._emitter = new EventEmitter();
        this._emitter.setMaxListeners(50000);
        if (socket) {
            this.socket = socket;
        }
    }

    protected _addSocketEventListener(eventName: string, fn: (...args: any[]) => void): void {
        if (nativeSocketEvents[eventName]) {
            eventName = nativeSocketEvents[eventName];
            this._webSocket?.addEventListener(eventName, fn);
        } else {
            this._emitter.on(eventName, fn);
        }
    }

    protected _addSocketEventListenerOnce(eventName: string, fn: (...args: any[]) => void): void {
        if (nativeSocketEvents[eventName]) {
            eventName = nativeSocketEvents[eventName];
            const once = (...args: any[]) => {
                this._webSocket?.removeEventListener(eventName, once);
                fn.call(this._webSocket, ...args);
            };

            this._webSocket?.addEventListener(eventName, once);
        } else {
            this._emitter.once(eventName, fn);
        }
    }

    protected _removeSocketEventListener(eventName: string, fn: (...args: any[]) => void): void {
        if (nativeSocketEvents[eventName]) {
            eventName = nativeSocketEvents[eventName];
            this._webSocket?.removeEventListener(eventName, fn);
        } else {
            this._emitter.removeListener(eventName, fn);
        }
    }

    protected _socketSend(event: string, payload: any, ack?: (...args: any[]) => void): Promise<any> {
        if (!this._webSocket) {
            throw new Error('socket does not exist');
        }

        let ackEvent: string | undefined;
        if (ack) {
            ackEvent = `lr-acks::${++acks}`;
            this._emitter.once(ackEvent, ack);
        }

        const message: LiveReplicaMessage = {
            [LIVE_REPLICA_MSG]: {
                event,
                payload,
                ack: ackEvent,
            }
        };

        this._webSocket.send(encode(message));
        return Promise.resolve();
    }

    set socket(socket: WebSocket) {
        const isReconnect = !!this._webSocket;

        this.disconnect();

        if (!socket || !socket.binaryType || socket.binaryType !== 'arraybuffer') {
            throw new TypeError(`socket must be a WebSocket with binaryType='arraybuffer'`);
        }

        this._webSocket = socket;
        this._adapter = new WebSocketAdapter(socket);
        super.connect(this._adapter);

        this[onMessage] = ({data}) => {
            const msg = decode(data) as LiveReplicaMessage;
            if (msg[LIVE_REPLICA_MSG]) {
                const {event, args = []} = msg[LIVE_REPLICA_MSG];
                this._emitter.emit(event, ...args);
            } else {
                this._emitter.emit('message', msg);
            }
        };

        this._webSocket.addEventListener('message', this[onMessage]);

        if (isReconnect) {
            this._emitter.emit('reconnect');
        }
    }

    get baseSocket(): BaseSocket | undefined {
        return this._adapter;
    }

    disconnect(): void {
        if (this._webSocket && this[onMessage]) {
            this._webSocket.removeEventListener('message', this[onMessage]);
        }
        this._webSocket = undefined;
        this._adapter = undefined;
        super.disconnect();
    }

    isConnected(): boolean {
        return !!this._webSocket && this._webSocket.readyState === WebSocket.OPEN;
    }
} 