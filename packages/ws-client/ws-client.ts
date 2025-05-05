import { EventEmitter } from "../events/events";
import { LiveReplicaSocket } from '../socket/socket';
// @ts-expect-error
import {encode, decode} from '../../node_modules/@msgpack/msgpack/dist.es5+esm/index.mjs';

const LIVE_REPLICA_MSG = '$LR';
const onMessage = Symbol('onWebsocketMessage');
let acks = Date.now();
const nativeSocketEvents = {'disconnect': 'close'};

export class WebSocketClient extends LiveReplicaSocket {
    protected _socket: any;
    protected _emitter: any;
    protected [onMessage]: any;

    constructor(socket?: any) {
        // @ts-expect-error
        super();
        if (socket) {
            this.socket = socket;
        }
        this._emitter = new EventEmitter();
        this._emitter.setMaxListeners(50000);
    }

    // overrides
    protected _addSocketEventListener(eventName: string, fn: (...args: any[]) => void) {
        // @ts-expect-error
        if (nativeSocketEvents[eventName]) {
            // @ts-expect-error
            eventName = nativeSocketEvents[eventName];
            this.socket.addEventListener(eventName, fn);
        } else {
            this._emitter.on(eventName, fn);
        }
    }
    protected _addSocketEventListenerOnce(eventName: string, fn: (...args: any[]) => void) {
        // @ts-expect-error
        if (nativeSocketEvents[eventName]) {
            // @ts-expect-error
            eventName = nativeSocketEvents[eventName];
            const once = (...args: any[]) => {
                this.socket.removeEventListener(eventName, once);
                fn.call(this.socket, ...args);
            };
            this.socket.addEventListener(eventName, once);
        } else {
            this._emitter.once(eventName, fn);
        }
    }

    _removeSocketEventListener(eventName: string, fn: (...args: any[]) => void) {
        // @ts-expect-error
        if (nativeSocketEvents[eventName]) {
            // @ts-expect-error
            eventName = nativeSocketEvents[eventName];
            this.socket.removeListener(eventName, fn);
        } else {
            this._emitter.removeListener(eventName, fn);
        }
    }

    protected _socketSend(eventName: string, payload: any, ack?: (...args: any[]) => void): Promise<any> {
        if (!this._socket) {
            throw new Error('socket does not exists');
        }
        let ackEvent;
        if (ack) {
            ackEvent = `lr-acks::${++acks}`;
            this.once(ackEvent, ack);
        }
        const message = {
            [LIVE_REPLICA_MSG]: {
                event,
                payload,
                ack: ackEvent,
            }
        };
        this._socket.send(encode(message));
        return Promise.resolve();
    }

    set socket(socket: any) {
        const isReconnect = !!this._socket;
        this.disconnect();
        if (!socket || !socket.binaryType || socket.binaryType !== 'arraybuffer') {
            throw new TypeError(`socket must be a WebSocket with binaryType='arraybuffer' `);
        }
        this._socket = socket;
        this[onMessage] = ({data}: any) => {
            const msg = decode(data);
            if (msg && msg[LIVE_REPLICA_MSG]) {
                const {event, args} = msg[LIVE_REPLICA_MSG];
                this._emitter.emit(event, ...(Array.isArray(args) ? args : []));
            } else {
                this._emitter.emit('message', msg);
            }
        };
        this._socket.addEventListener('message', this[onMessage]);
        if (isReconnect) {
            this._emitter.emit('reconnect');
        }
    }

    get socket(): any {
        return this._socket;
    }

    get baseSocket(): any {
        return this._socket;
    }

    disconnect() {
        if (this._socket && this[onMessage]) {
            this._socket.removeEventListener('message', this[onMessage]);
        }
        delete this._socket;
        // todo: check if we need to call super.disconnect() here
    }

    isConnected(): boolean { return this._socket && this._socket.readyState === WebSocket.OPEN; }
}

export default WebSocketClient; 