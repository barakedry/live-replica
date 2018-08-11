/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const LiveReplicaEvents = require('../common/events');
const Events = require('events');
const LiveReplicaSocket = require('@live-replica/socket');

/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaWorkerSocket extends LiveReplicaSocket {

    constructor() {
        super();
    }

    _addSocketEventListener(eventName, fn) {

    }

    _removeSocketEventListener(eventName, fn) {
    }

    _socketSend(event, payload, ack) {

        if (!this.worker) {
            throw new Error('worker does not exists');
        }

        const message = {
            liveReplica: {
                event,
                payload
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
                const {event, payload} = data.liveReplica;
                this.emit(event, payload);
            }
        };

        this.worker.addEventListener('message', this.onWorkerMessage);
    }

    disconnect() {
        this.worker.removeEventListener('message', this.onWorkerMessage);
        delete this.socket;
    }

    isConnected() { return !!this.socket; }
}

module.exports = LiveReplicaWorkerSocket;