import { eventName } from "../common/event-name";
import { EventEmitter } from '../events/events';
import { LiveReplicaServer } from '../server';
import * as cluster from "cluster";

class Connection extends EventEmitter {
    socket: any;
    messageFromWorkerProcess: (msg: any) => void;
    constructor(worker: any) {
        super();
        this.setMaxListeners(50000);
        this.socket = worker;
        this.messageFromWorkerProcess = (msg: any) => {
            if (typeof msg !== 'object' || !msg.liveReplica) {
                return;
            }
            const {event, payload, ack} = msg.liveReplica;
            let ackFunction;
            if (ack) {
                ackFunction = (...args: any[])=> {
                    this.send(ack, ...args);
                }
            }
            this.emit(event, payload, ackFunction);
        };
        this.socket.on('message', this.messageFromWorkerProcess);
    }
    send(event: string, ...args: any[]) {
        event = eventName(event);
        this.socket.send({
            liveReplica: {
                event,
                args
            }
        });
    }
    emit(event: string, ...args: any[]) {
        event = eventName(event);
        const callArgs = [event].concat(args);
        // @ts-expect-error
        super.emit.apply(this, callArgs);
    }
    _addListener(event: string, handler: any) {
        this.addListener(eventName(event), handler);
        this.socket.on(eventName(event), handler);
    }
    // @ts-expect-error
    on(event: string, handler: any) {
        this._addListener(eventName(event), handler);
    }
    // @ts-expect-error
    removeListener(event: string, handler: any) {
        // @ts-expect-error
        super.removeListener(eventName(event), handler);
        this.socket.removeListener(eventName(event), handler);
    }
}

/**
 *  NodeClusterServer
 */
export class NodeClusterServer extends LiveReplicaServer {
    constructor() {
        // @ts-expect-error
        if (!cluster.isMaster) {
            throw new Error('LiveReplicaNodeClusterServer can be initiated only on a node.js cluster master process')
        }
        super({});
        // @ts-expect-error
        cluster.on('online', (worker: any) => {
            this.onConnect(new Connection(worker));
        });
    }
}

export default NodeClusterServer;