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
const events_1 = require("../events/events");
const socket_1 = require("../socket/socket");
const cluster = __importStar(require("node:cluster"));
let acks = 1;
/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaClusterWorkerSocket extends socket_1.LiveReplicaSocket {
    static get instance() {
        if (!this._instance) {
            this._instance = new LiveReplicaClusterWorkerSocket();
        }
        return this._instance;
    }
    constructor() {
        // @ts-expect-error related to node version
        if (!cluster.isWorker) {
            throw new Error('LiveReplicaClusterWorkerSocket can be initiated only on a node.js cluster worker process');
        }
        super(process);
        this._emitter = new events_1.EventEmitter();
        this._emitter.setMaxListeners(50000);
        process.on('message', (msg) => {
            if (typeof msg === 'object' && msg.liveReplica) {
                const { event, args } = msg.liveReplica;
                this._emitter.emit(event, ...args);
            }
        });
    }
    // overrides
    _addSocketEventListener(eventName, fn) {
        this._emitter.on(eventName, fn);
    }
    _addSocketEventListenerOnce(eventName, fn) {
        this._emitter.once(eventName, fn);
    }
    _removeSocketEventListener(eventName, fn) {
        this._emitter.removeListener(eventName, fn);
    }
    _socketSend(event, payload, ack) {
        let ackEvent;
        if (ack) {
            ackEvent = `lr-acks::${++acks}`;
            this._emitter.once(ackEvent, ack);
        }
        const message = {
            liveReplica: {
                event,
                payload,
                ack: ackEvent,
            }
        };
        process.send(message);
        return Promise.resolve();
    }
    get baseSocket() {
        return process;
    }
    isConnected() { return true; }
}
module.exports = LiveReplicaClusterWorkerSocket;
//# sourceMappingURL=cluster-worker-socket.js.map