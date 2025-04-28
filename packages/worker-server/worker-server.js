import { eventName } from "../common/event-name.js";
import { EventEmitter } from '@live-replica/events';
import {LiveReplicaServer} from '@live-replica/server';

class MessageChannelConnection extends EventEmitter {
    port = null;

    constructor(port = self) {
        super();

        this.port = port;
        this.setMaxListeners(50000);

        this.onMessage = ({data}) => {
            if (data.liveReplica) {
                const {event, payload, ack} = data.liveReplica;

                let ackFunction;
                if (ack) {
                    ackFunction = (...args)=> {
                        this.send(ack, ...args);
                    }
                }

                this.emit(event, payload, ackFunction);
            }
        };

        this.port.addEventListener('message', this.onMessage);
    }


    send(event, ...args) {
        event = eventName(event);
        this.port.postMessage({
            liveReplica: {
                event,
                args
            }
        });
    }


    emit(event, ...args) {
        event = eventName(event);
        const callArgs = [event].concat(args);
        super.emit.apply(this, callArgs);
    }

    addEventListener(event, handler) {
        super.addEventListener(eventName(event), handler);
    }

    removeListener(event, handler) {
        super.removeListener(eventName(event), handler);
    }

}

class WorkerConnection extends EventEmitter {
    worker = null;

    constructor(worker) {

        super();

        this.worker = worker;
        this.setMaxListeners(50000);

        this.onMessage = ({data}) => {
            if (data.liveReplica) {
                const {event, payload, ack} = data.liveReplica;

                let ackFunction;
                if (ack) {
                    ackFunction = (...args)=> {
                        this.send(ack, ...args);
                    }
                }

                this.emit(event, payload, ackFunction);
            }
        };

        this.worker.addEventListener('message', this.onMessage);
    }


    send(event, ...args) {
        event = eventName(event);
        this.worker.postMessage({
            liveReplica: {
                event,
                args
            }
        });
    }


    emit(event, ...args) {
        event = eventName(event);
        const callArgs = [event].concat(args);
        super.emit.apply(this, callArgs);
    }

    addEventListener(event, handler) {
        super.addEventListener(eventName(event), handler);
    }

    removeListener(event, handler) {
        super.removeListener(eventName(event), handler);
    }

}

export function createConnection(workerOrPort) {
    if (workerOrPort instanceof MessagePort) {
        return new MessageChannelConnection(workerOrPort);
    } else {
        return new WorkerConnection(workerOrPort);
    }
}

/**
 *  LiveReplicaWorkerSocket
 */
export class WorkerServer extends LiveReplicaServer {
    constructor(options) {
        if (!(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)) {
            throw new Error('WorkerServer can be initiated only inside a web worker')
        }
        super(options);
    }
}

export default WorkerServer;