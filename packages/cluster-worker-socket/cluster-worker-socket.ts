import { EventEmitter } from '../events/events';
import { LiveReplicaSocket } from '../socket/socket';
import * as cluster from "node:cluster";

let acks = 1;
/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaClusterWorkerSocket extends LiveReplicaSocket {
    static _instance: LiveReplicaClusterWorkerSocket;
    private _emitter: EventEmitter;

    static get instance() {
        if (!this._instance) {
            this._instance = new LiveReplicaClusterWorkerSocket();
        }

        return this._instance;
    }

    constructor() {
        // @ts-expect-error related to node version
        if (!cluster.isWorker) {
            throw new Error('LiveReplicaClusterWorkerSocket can be initiated only on a node.js cluster worker process')
        }
        super(process);
        this._emitter = new EventEmitter();
        this._emitter.setMaxListeners(50000);

        process.on('message', (msg: any) => {
            if (typeof msg === 'object' && msg.liveReplica) {
                const {event, args} = msg.liveReplica;
                this._emitter.emit(event, ...args);
            }
        });
    }

    // overrides

    _addSocketEventListener(eventName: string, fn: (...args: any[]) => void) {
        this._emitter.on(eventName, fn);
    }
    _addSocketEventListenerOnce(eventName: string, fn: (...args: any[]) => void) {
        this._emitter.once(eventName, fn);
    }

    _removeSocketEventListener(eventName: string, fn: (...args: any[]) => void) {
        this._emitter.removeListener(eventName, fn);
    }

    _socketSend(event: string, payload: any, ack: any) {
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

        process.send!(message);
    }

    get baseSocket() {
        return process;
    }

    isConnected() { return true; }
}

module.exports = LiveReplicaClusterWorkerSocket;