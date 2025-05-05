import { EventEmitter } from '../events/events';
import { LiveReplicaSocket } from '../socket/socket';

let acks = 1;
export class WorkerSocket extends LiveReplicaSocket {
    _emitter: any;
    worker: any;
    onWorkerMessage: any;
    previuslySetTerminate: any;
    socket: any;
    constructor() {
        // @ts-expect-error
        super();
        this._emitter = new EventEmitter();
        this._emitter.setMaxListeners(50000);
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
    // @ts-expect-error
    _socketSend(event: string, payload: any, ack?: (...args: any[]) => void) {
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
    connect(worker: any) {
        if (this.worker === worker) {
            return;
        }
        if (this.worker && this.onWorkerMessage) {
            this.worker.removeEventListener('message', this.onWorkerMessage);
        }
        this.worker = worker;
        this.onWorkerMessage = ({data}: any) => {
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
        this.worker.terminate = (...args: any[]) => {
            this.disconnect();
            setTimeout(() => terminate(...args), 500);
        };
        this.worker.addEventListener('error', (e: any) => {
            console.error("Worker Error:", e.message, e);
        });
    }
    disconnect() {
        this.send('disconnect', undefined);
        this.worker.removeEventListener('message', this.onWorkerMessage);
        if (this.previuslySetTerminate) {
            this.worker.terminate = this.previuslySetTerminate;
            delete this.previuslySetTerminate;
        } else {
            delete this.worker.terminate;
        }
        this.socket = undefined;
    }
    isConnected() { return !!this.socket; }
}

export default WorkerSocket;