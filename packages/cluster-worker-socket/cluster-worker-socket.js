import { EventEmitter } from '../events/events.js';
import { LiveReplicaSocket } from '../socket/socket.js';
import * as cluster from "node:cluster";

let acks = 1;
/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaClusterWorkerSocket extends LiveReplicaSocket {

    static get instance() {
        if (!this._instance) {
            this._instance = new LiveReplicaClusterWorkerSocket();
        }

        return this._instance;
    }

    constructor() {
        if (!cluster.isWorker) {
            throw new Error('LiveReplicaClusterWorkerSocket can be initiated only on a node.js cluster worker process')
        }
        super();
        this._emitter = new EventEmitter();
        this._emitter.setMaxListeners(50000);

        process.on('message', (msg) => {
            if (typeof msg === 'object' && msg.liveReplica) {
                const {event, args} = msg.liveReplica;
                this._emitter.emit(event, ...args);
            }
        });
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

        process.send(message);
    }

    get baseSocket() {
        return process;
    }

    isConnected() { return true; }
}

module.exports = LiveReplicaClusterWorkerSocket;