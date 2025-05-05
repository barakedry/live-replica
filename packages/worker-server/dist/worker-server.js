"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerServer = void 0;
exports.createConnection = createConnection;
const event_name_1 = require("../common/event-name");
const events_1 = require("../events/events");
const index_1 = require("../server/index");
class MessageChannelConnection extends events_1.EventEmitter {
    constructor(port = self) {
        super();
        this.port = port;
        this.setMaxListeners(50000);
        this.onMessage = ({ data }) => {
            if (data.liveReplica) {
                const { event, payload, ack } = data.liveReplica;
                let ackFunction;
                if (ack) {
                    ackFunction = (...args) => {
                        this.send(ack, ...args);
                    };
                }
                this.emit(event, payload, ackFunction);
            }
        };
        this.port.addEventListener('message', this.onMessage);
    }
    send(event, ...args) {
        event = (0, event_name_1.eventName)(event);
        this.port.postMessage({
            liveReplica: {
                event,
                args
            }
        });
    }
    emit(event, ...args) {
        event = (0, event_name_1.eventName)(event);
        const callArgs = [event].concat(args);
        super.emit.apply(this, callArgs);
    }
    // @ts-expect-error
    addEventListener(event, handler) {
        // @ts-expect-error
        super.addEventListener((0, event_name_1.eventName)(event), handler);
    }
    // @ts-expect-error
    removeListener(event, handler) {
        // @ts-expect-error
        super.removeListener((0, event_name_1.eventName)(event), handler);
    }
}
class WorkerConnection extends events_1.EventEmitter {
    constructor(worker) {
        super();
        this.worker = worker;
        this.setMaxListeners(50000);
        this.onMessage = ({ data }) => {
            if (data.liveReplica) {
                const { event, payload, ack } = data.liveReplica;
                let ackFunction;
                if (ack) {
                    ackFunction = (...args) => {
                        this.send(ack, ...args);
                    };
                }
                this.emit(event, payload, ackFunction);
            }
        };
        this.worker.addEventListener('message', this.onMessage);
    }
    send(event, ...args) {
        event = (0, event_name_1.eventName)(event);
        this.worker.postMessage({
            liveReplica: {
                event,
                args
            }
        });
    }
    emit(event, ...args) {
        event = (0, event_name_1.eventName)(event);
        const callArgs = [event].concat(args);
        super.emit.apply(this, callArgs);
    }
    // @ts-expect-error
    addEventListener(event, handler) {
        // @ts-expect-error
        super.addEventListener((0, event_name_1.eventName)(event), handler);
    }
    // @ts-expect-error
    removeListener(event, handler) {
        // @ts-expect-error
        super.removeListener((0, event_name_1.eventName)(event), handler);
    }
}
function createConnection(workerOrPort) {
    if (workerOrPort instanceof MessagePort) {
        return new MessageChannelConnection(workerOrPort);
    }
    else {
        return new WorkerConnection(workerOrPort);
    }
}
/**
 *  LiveReplicaWorkerSocket
 */
class WorkerServer extends index_1.LiveReplicaServer {
    constructor(options) {
        if (!(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)) {
            throw new Error('WorkerServer can be initiated only inside a web worker');
        }
        super(options);
    }
}
exports.WorkerServer = WorkerServer;
exports.default = WorkerServer;
//# sourceMappingURL=worker-server.js.map