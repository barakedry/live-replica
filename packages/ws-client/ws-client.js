/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const LiveReplicaSocket = require('../socket');
const LiveReplicaEvents = require('../common/events');
const Events = require('events');
const msgpack = require('@msgpack/msgpack');
const LIVE_REPLICA_MSG = '$LR';
const onMessage = Symbol('onWebsocketMessage');
let acks = Date.now();
const nativeSocketEvents = {'disconnect': 'close'};

/**
 *  LiveReplicaWebSocketsClient
 */
class LiveReplicaWebSocketsClient extends LiveReplicaSocket {

    constructor(socket) {
        super();
        this.socket = socket;
        this._emitter = new Events.EventEmitter();
        this._emitter.setMaxListeners(50000);
    }

    // overrides

    _addSocketEventListener(eventName, fn) {
        if (nativeSocketEvents[eventName]) {
            eventName = nativeSocketEvents[eventName];
            this.socket.addEventListener(eventName, fn);
        } else {
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
        } else {
            this._emitter.once(eventName, fn);
        }

    }

    _removeSocketEventListener(eventName, fn) {
        if (nativeSocketEvents[eventName]) {
            eventName = nativeSocketEvents[eventName];
            this.socket.removeListener(eventName, fn);
        } else {
            this._emitter.removeListener(eventName, fn);
        }

    }

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

        this._socket.send(msgpack.encode(message));
    }

    set socket(socket) {

        const isReconnect = !!this._socket;

        this.disconnect();

        if (!socket || !socket.binaryType || socket.binaryType !== 'arraybuffer') {
            throw new TypeError(`socket must be a WebSocket with binaryType='arraybuffer' `);
        }

        this._socket = socket;

        this[onMessage] = ({data}) => {
            const msg = msgpack.decode(data);
            if (msg[LIVE_REPLICA_MSG]) {
                const {event, args} = msg[LIVE_REPLICA_MSG];
                this._emitter.emit(event, ...args);
            } else {
                this._emitter.emit('message', msg);
            }
        };

        this._socket.addEventListener('message', this[onMessage]);

        if (isReconnect) {
            this._emitter.emit('reconnect');
        }
    }

    get baseSocket() {
        return this._socket;
    }

    disconnect() {
        if (this._socket && this[onMessage]) {
            this._socket.removeEventListener('message', this[onMessage]);
        }
        delete this._socket;
    }

    isConnected() { return this._socket && this._socket.readyState === WebSocket.OPEN; }
    
}

module.exports = LiveReplicaWebSocketsClient;