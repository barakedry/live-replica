import {eventName} from "../common/event-name.js";
import { EventEmitter } from '../events/events.js';
import { LiveReplicaServer } from '../server/index.js';

class Connection extends EventEmitter {
    constructor(port) {
        super();

        this.port = port;

        this.setMaxListeners(50000);

        this.messageFromMaster = ({data}) => {
            if (data.liveReplica) {
                const {event, payload, ack} = data.liveReplica;

                let ackFunction;
                if (ack) {
                    ackFunction = (...args) => {
                        this.send(ack, ...args);
                    }
                }

                this.emit(event, payload, ackFunction);
            }
        };

        this.port.onmessage = this.messageFromMaster;

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

/**
 *  LiveReplicaWorkerSocket
 */
export class LiveReplicaSharedWorkerServer extends LiveReplicaServer {
    constructor(port) {
        super();

        this._masterConnection = new Connection(port);
        this.onConnect(this._masterConnection)
    }
}

export default LiveReplicaSharedWorkerServer;