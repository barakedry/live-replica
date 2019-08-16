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
/**
 *  LiveReplicaSocketIoClient
 */
class LiveReplicaWebSocketsClient extends LiveReplicaSocket {

    constructor(socket) {
        super(socket);

        if (!this._socket || !this._socket.binaryType || this._socket.binaryType !== 'arraybuffer') {
            throw new TypeError(`socket must be a WebSocket with binaryType='arraybuffer' `);
        }
        
        this._emitter = new Events.EventEmitter();
        this._emitter.setMaxListeners(50000);

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
    }

    // overrides

    _addSocketEventListener(eventName, fn) {
        this._emitter.on(eventName, fn);
    }
    _addSocketEventListenerOnce(eventName, fn) {
        this._emitter.once(eventName, fn);
    }

    _removeSocketEventListener(eventName, fn) {
        this._emitter.removeListener(eventName, fn);
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

    get baseSocket() {
        return this._socket;
    }

    disconnect() {
        this._socket.removeEventListener('message', this[onMessage]);
        delete this._socket;
    }

    isConnected() { return this._socket && this._socket.readyState === WebSocket.OPEN; }
    
}

module.exports = LiveReplicaWebSocketsClient;