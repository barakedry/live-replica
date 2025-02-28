import { EventEmitter } from '../events/events.js';
import { LiveReplicaSocket } from '../socket/socket.js';

let acks = 1;
export class WorkerSocket extends LiveReplicaSocket {

    constructor() {
        super();
        this._emitter = new EventEmitter();
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
        if (this.worker === worker) {
            return;
        }

        if (this.worker && this.onWorkerMessage) {
            this.worker.removeEventListener('message', this.onWorkerMessage);
        }

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

export default WorkerSocket;