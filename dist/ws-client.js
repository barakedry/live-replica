"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const events_1 = require("../events/events");
const socket_1 = require("../socket/socket");
const index_mjs_1 = require("../../node_modules/@msgpack/msgpack/dist.es5+esm/index.mjs");
const LIVE_REPLICA_MSG = '$LR';
const onMessage = Symbol('onWebsocketMessage');
let acks = Date.now();
const nativeSocketEvents = { 'disconnect': 'close' };
class WebSocketClient extends socket_1.LiveReplicaSocket {
    constructor(socket) {
        // @ts-expect-error
        super();
        if (socket) {
            this.socket = socket;
        }
        this._emitter = new events_1.EventEmitter();
        this._emitter.setMaxListeners(50000);
    }
    // overrides
    _addSocketEventListener(eventName, fn) {
        if (nativeSocketEvents[eventName]) {
            eventName = nativeSocketEvents[eventName];
            this.socket.addEventListener(eventName, fn);
        }
        else {
            this._emitter.on(eventName, fn);
        }
    }
    _addSocketEventListenerOnce(eventName, fn) {
        if (nativeSocketEvents[eventName]) {
            eventName = nativeSocketEvents[eventName];
            const once = (...args) => {
                this.socket.removeEventListener(eventName, once);
                fn.call(this.socket, ...args);
            };
            this.socket.addEventListener(eventName, once);
        }
        else {
            this._emitter.once(eventName, fn);
        }
    }
    _removeSocketEventListener(eventName, fn) {
        if (nativeSocketEvents[eventName]) {
            eventName = nativeSocketEvents[eventName];
            this.socket.removeListener(eventName, fn);
        }
        else {
            this._emitter.removeListener(eventName, fn);
        }
    }
    // @ts-expect-error
    _socketSend(event, payload, ack) {
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
        this._socket.send((0, index_mjs_1.encode)(message));
    }
    set socket(socket) {
        const isReconnect = !!this._socket;
        this.disconnect();
        if (!socket || !socket.binaryType || socket.binaryType !== 'arraybuffer') {
            throw new TypeError(`socket must be a WebSocket with binaryType='arraybuffer' `);
        }
        this._socket = socket;
        this[onMessage] = ({ data }) => {
            const msg = (0, index_mjs_1.decode)(data);
            if (msg && msg[LIVE_REPLICA_MSG]) {
                const { event, args } = msg[LIVE_REPLICA_MSG];
                this._emitter.emit(event, ...(Array.isArray(args) ? args : []));
            }
            else {
                this._emitter.emit('message', msg);
            }
        };
        this._socket.addEventListener('message', this[onMessage]);
        if (isReconnect) {
            this._emitter.emit('reconnect');
        }
    }
    get socket() {
        return this._socket;
    }
    get baseSocket() {
        return this._socket;
    }
    disconnect() {
        if (this._socket && this[onMessage]) {
            this._socket.removeEventListener('message', this[onMessage]);
        }
        delete this._socket;
        // todo: check if we need to call super.disconnect() here
    }
    isConnected() { return this._socket && this._socket.readyState === WebSocket.OPEN; }
}
exports.WebSocketClient = WebSocketClient;
exports.default = WebSocketClient;
//# sourceMappingURL=ws-client.js.map