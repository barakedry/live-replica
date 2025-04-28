import { eventName} from "../common/event-name.js";
import { EventEmitter } from '@live-replica/events';
import { LiveReplicaServer } from '@live-replica/server';
import * as cluster from "node:cluster";

class Connection extends EventEmitter {
    constructor(worker) {
        super();
        this.setMaxListeners(50000);

        this.socket = worker;
        this.messageFromWorkerProcess = (msg) => {
            if (typeof msg !== 'object' || !msg.liveReplica) {
                return;
            }

            const {event, payload, ack} = msg.liveReplica;

            let ackFunction;
            if (ack) {
                ackFunction = (...args)=> {
                    this.send(ack, ...args);
                }
            }

            this.emit(event, payload, ackFunction);
        };

        this.socket.on('message', this.messageFromWorkerProcess);
    }

    send(event, ...args) {
        event = eventName(event);
        this.socket.send({
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

    _addListener(event, handler) {
        this.addListener(eventName(event), handler);
        this.socket.on(eventName(event), handler);
    }

    on(event, handler) {
        this._addListener(eventName(event), handler);
    }

    removeListener(event, handler) {
        super.removeListener(eventName(event), handler);
        this.socket.removeListener(eventName(event), handler);
    }

}

/**
 *  NodeClusterServer
 */
export class NodeClusterServer extends LiveReplicaServer {
    constructor() {
        if (!cluster.isMaster) {
            throw new Error('LiveReplicaNodeClusterServer can be initiated only on a node.js cluster master process')
        }

        super();

        cluster.on('online', (worker) => {
            this.onConnect(new Connection(worker));
        });

    }

}

export default NodeClusterServer;