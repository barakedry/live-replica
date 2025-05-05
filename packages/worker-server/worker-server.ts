import { eventName } from "../common/event-name";
import { EventEmitter } from '../events/events';
import {LiveReplicaServer} from '../server/index';

class MessageChannelConnection extends EventEmitter {
    port: any;
    onMessage: ({ data }: { data: any; }) => void;

    constructor(port = self) {
        super();

        this.port = port;
        this.setMaxListeners(50000);

        this.onMessage = ({ data }: { data: any; }) => {
            if (data.liveReplica) {
                const {event, payload, ack} = data.liveReplica;

                let ackFunction;
                if (ack) {
                    ackFunction = (...args: any[]) => {
                        this.send(ack, ...args);
                    }
                }

                this.emit(event, payload, ackFunction);
            }
        };

        this.port.addEventListener('message', this.onMessage);
    }


    send(event: string, ...args: any[]) {
        event = eventName(event);
        this.port.postMessage({
            liveReplica: {
                event,
                args
            }
        });
    }


    emit(event: string, ...args: any[]) {
        event = eventName(event);
        const callArgs = [event].concat(args) as [string, ...any[]];
        super.emit.apply(this, callArgs);
    }

    // @ts-expect-error
    addEventListener(event: string, handler: EventListener) {
        // @ts-expect-error
        super.addEventListener(eventName(event), handler);
    }

    // @ts-expect-error
    removeListener(event: string, handler: EventListener) {
        // @ts-expect-error
        super.removeListener(eventName(event), handler);
    }

}

class WorkerConnection extends EventEmitter {
    worker: any;
    onMessage: ({ data }: { data: any; }) => void;

    constructor(worker: any) {

        super();

        this.worker = worker;
        this.setMaxListeners(50000);

        this.onMessage = ({ data }: { data: any; }) => {
            if (data.liveReplica) {
                const {event, payload, ack} = data.liveReplica;

                let ackFunction;
                if (ack) {
                    ackFunction = (...args: any[]) => {
                        this.send(ack, ...args);
                    }
                }

                this.emit(event, payload, ackFunction);
            }
        };

        this.worker.addEventListener('message', this.onMessage);
    }


    send(event: string, ...args: any[]) {
        event = eventName(event);
        this.worker.postMessage({
            liveReplica: {
                event,
                args
            }
        });
    }


    emit(event: string, ...args: any[]) {
        event = eventName(event);
        const callArgs = [event].concat(args) as [string, ...any[]];
        super.emit.apply(this, callArgs);
    }

    // @ts-expect-error
    addEventListener(event: string, handler: EventListener) {
        // @ts-expect-error
        super.addEventListener(eventName(event), handler);
    }

    // @ts-expect-error
    removeListener(event: string, handler: EventListener) {
        // @ts-expect-error
        super.removeListener(eventName(event), handler);
    }

}

export function createConnection(workerOrPort: any) {
    if (workerOrPort instanceof MessagePort) {
        return new MessageChannelConnection(workerOrPort as unknown as Window & typeof globalThis);
    } else {
        return new WorkerConnection(workerOrPort);
    }
}

/**
 *  LiveReplicaWorkerSocket
 */
export class WorkerServer extends LiveReplicaServer {
    constructor(options: any) {
        if (!(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)) {
            throw new Error('WorkerServer can be initiated only inside a web worker')
        }
        super(options);
    }
}

export default WorkerServer;