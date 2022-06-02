/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const LiveReplicaEvents = require('../common/event-name');
const Events = require('events');
const LiveReplicaSocket = require('../socket');
let acks = 1;
/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaWorkerSocket extends LiveReplicaSocket {

    constructor() {
        super();
        this._emitter = new Events.EventEmitter();
        this._emitter.setMaxListeners(50000);
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

        if (!this.worker) {
            throw new Error('worker does not exists');
        }

        let ackEvent;
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

        this.worker.postMessage(message);
    }

    get baseSocket() {
        return this.worker;
    }

    connect(worker) {
        this.worker = worker;
        this.onWorkerMessage = ({data}) => {
            if (data.liveReplica) {
                const {event, args} = data.liveReplica;
                this._emitter.emit(event, ...args);
            }
        };

        this.worker.addEventListener('message', this.onWorkerMessage);
    }

    disconnect() {
        this.worker.removeListener('message', this.onWorkerMessage);
        delete this.socket;
    }

    isConnected() { return !!this.socket; }
}

module.exports = LiveReplicaWorkerSocket;