import { eventName } from "../common/event-name.js";
import { EventEmitter } from '../events/events.js';
import {LiveReplicaServer} from '../server/index.js';

class Connection extends EventEmitter {
    constructor() {
        super();

        this.setMaxListeners(50000);

        this.messageFromMaster = ({data}) => {
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
    }

    //todo: need a better name here
    get messagePort() {
        return self;
    }

    init() {
        self.addEventListener('message', this.messageFromMaster);
    }

    send(event, ...args) {
        event = eventName(event);
        this.messagePort.postMessage({
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

class MessagePortConnection extends Connection {
    /**
     * @param {MessagePort} port
     */
    constructor(port) {
        super();
        this.port = port;
    }

    get messagePort() {
        return this.port;
    }

    init() {
        this.port.addEventListener('message', this.messageFromMaster);
        this.port.start();
    }
}

/**
 *  LiveReplicaWorkerSocket
 */
export class WorkerServer extends LiveReplicaServer {
    constructor(options) {
        if (!self) {
            throw new Error('WorkerServer can be initiated only inside a web worker')
        }
        super(options);

        this._masterConnection = new Connection();
        this._masterConnection.init();
        this.onConnect(this._masterConnection)
    }

    /**
     * @param {MessagePort} port
     */
    addPortConnection(port) {
        const portConnection = new MessagePortConnection(port);
        portConnection.init();
        this.onConnect(new MessagePortConnection(port));
    }
}

export default WorkerServer;