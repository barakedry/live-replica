"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveReplicaSharedWorkerServer = void 0;
const event_name_1 = require("../common/event-name");
const events_1 = require("../events/events");
const index_1 = require("../server/index");
class Connection extends events_1.EventEmitter {
    constructor(port) {
        super();
        this.port = port;
        this.setMaxListeners(50000);
        this.messageFromMaster = ({ data }) => {
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
        this.port.onmessage = this.messageFromMaster;
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
        super.emit(...callArgs);
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
/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaSharedWorkerServer extends index_1.LiveReplicaServer {
    constructor(port) {
        // @ts-expect-error
        super();
        this._masterConnection = new Connection(port);
        this.onConnect(this._masterConnection);
    }
}
exports.LiveReplicaSharedWorkerServer = LiveReplicaSharedWorkerServer;
exports.default = LiveReplicaSharedWorkerServer;
//# sourceMappingURL=shared-worker-server.js.map