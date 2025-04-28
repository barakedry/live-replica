import { EventEmitter } from '@live-replica/events';
import { LiveReplicaSocket } from '@live-replica/socket';

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

        // monkey patch terminate to detect when the worker is terminated
        const terminate = this.worker.terminate.bind(this.worker);
        if (this.worker.hasOwnProperty('terminate')) {
            this.previuslySetTerminate = this.worker.terminate;
        }

        this.worker.terminate = (...args) => {
            this.disconnect();
            terminate(...args);
        };

        this.worker.addEventListener('error', (e) => {
            console.error("Worker Error:", e.message, e);
        });
    }


    disconnect() {
        this.send('disconnect');
        this.worker.removeEventListener('message', this.onWorkerMessage);

        if (this.previuslySetTerminate) {
            this.worker.terminate = this.previuslySetTerminate;
            delete this.previuslySetTerminate;
        } else {
            delete this.worker.terminate;
        }

        delete this.socket;
    }

    isConnected() { return !!this.socket; }
}

export default WorkerSocket;