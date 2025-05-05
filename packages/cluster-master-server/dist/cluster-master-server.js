"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeClusterServer = void 0;
const event_name_1 = require("../common/event-name");
const events_1 = require("../events/events");
const server_1 = require("../server");
const cluster = __importStar(require("cluster"));
class Connection extends events_1.EventEmitter {
    constructor(worker) {
        super();
        this.setMaxListeners(50000);
        this.socket = worker;
        this.messageFromWorkerProcess = (msg) => {
            if (typeof msg !== 'object' || !msg.liveReplica) {
                return;
            }
            const { event, payload, ack } = msg.liveReplica;
            let ackFunction;
            if (ack) {
                ackFunction = (...args) => {
                    this.send(ack, ...args);
                };
            }
            this.emit(event, payload, ackFunction);
        };
        this.socket.on('message', this.messageFromWorkerProcess);
    }
    send(event, ...args) {
        event = (0, event_name_1.eventName)(event);
        this.socket.send({
            liveReplica: {
                event,
                args
            }
        });
    }
    emit(event, ...args) {
        event = (0, event_name_1.eventName)(event);
        const callArgs = [event].concat(args);
        // @ts-expect-error
        super.emit.apply(this, callArgs);
    }
    _addListener(event, handler) {
        this.addListener((0, event_name_1.eventName)(event), handler);
        this.socket.on((0, event_name_1.eventName)(event), handler);
    }
    // @ts-expect-error
    on(event, handler) {
        this._addListener((0, event_name_1.eventName)(event), handler);
    }
    // @ts-expect-error
    removeListener(event, handler) {
        // @ts-expect-error
        super.removeListener((0, event_name_1.eventName)(event), handler);
        this.socket.removeListener((0, event_name_1.eventName)(event), handler);
    }
}
/**
 *  NodeClusterServer
 */
class NodeClusterServer extends server_1.LiveReplicaServer {
    constructor() {
        // @ts-expect-error
        if (!cluster.isMaster) {
            throw new Error('LiveReplicaNodeClusterServer can be initiated only on a node.js cluster master process');
        }
        super({});
        // @ts-expect-error
        cluster.on('online', (worker) => {
            this.onConnect(new Connection(worker));
        });
    }
}
exports.NodeClusterServer = NodeClusterServer;
exports.default = NodeClusterServer;
//# sourceMappingURL=cluster-master-server.js.map