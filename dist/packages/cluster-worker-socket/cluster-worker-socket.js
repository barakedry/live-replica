import { EventEmitter } from '../events/events';
import { LiveReplicaSocket } from '../socket/socket';
import * as cluster from "node:cluster";
let acks = 1;
/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaClusterWorkerSocket extends LiveReplicaSocket {
    static _instance;
    _emitter;
    static get instance() {
        if (!this._instance) {
            this._instance = new LiveReplicaClusterWorkerSocket();
        }
        return this._instance;
    }
    constructor() {
        if (!cluster.isWorker) {
            throw new Error('LiveReplicaClusterWorkerSocket can be initiated only on a node.js cluster worker process');
        }
        super(process);
        this._emitter = new EventEmitter();
        this._emitter.setMaxListeners(50000);
        process.on('message', (msg) => {
            if (typeof msg === 'object' && msg.liveReplica) {
                const { event, args } = msg.liveReplica;
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
            this._emitter.once(ackEvent, ack);
        }
        const message = {
            liveReplica: {
                event,
                payload,
                ack: ackEvent,
            }
        };
        process.send(message);
        return Promise.resolve();
    }
    get baseSocket() {
        return process;
    }
    isConnected() { return true; }
}
module.exports = LiveReplicaClusterWorkerSocket;
//# sourceMappingURL=cluster-worker-socket.js.map