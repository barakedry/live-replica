"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveReplicaWebSocketsServer = void 0;
const event_name_js_1 = require("../common/event-name.js");
const events_js_1 = require("../events/events.js");
const index_js_1 = require("../server/index.js");
// @ts-expect-error
const index_mjs_1 = require("../../node_modules/@msgpack/msgpack/dist.es5+esm/index.mjs");
const LIVE_REPLICA_MSG = '$LR';
const nativeSocketEvents = { 'disconnect': 'close' };
class Connection extends events_js_1.EventEmitter {
    constructor(ws) {
        super();
        this.setMaxListeners(50000);
        this.socket = ws;
        this.socket.setMaxListeners(50000);
        this.socket.addEventListener('message', ({ data }) => {
            try {
                const msg = (0, index_mjs_1.decode)(data);
                if (msg && msg[LIVE_REPLICA_MSG]) {
                    const { event, payload, ack } = msg[LIVE_REPLICA_MSG];
                    let ackFunction;
                    if (ack) {
                        ackFunction = (...args) => {
                            this.send(ack, ...args);
                        };
                    }
                    this.emit(event, payload, ackFunction);
                }
                else {
                    this.emit('unknown-message', msg);
                }
            }
            catch (e) {
                this.emit('decoding-error', e, data);
                console.error('[LiveReplica] unable to decode msgpack from socket', e);
            }
        });
    }
    send(event, ...args) {
        event = (0, event_name_js_1.eventName)(event);
        const message = {
            [LIVE_REPLICA_MSG]: {
                event,
                args
            }
        };
        try {
            const data = (0, index_mjs_1.encode)(message);
            this.socket.send(data);
        }
        catch (e) {
            console.error('[LiveReplica] unable to encode msgpack to socket', e);
        }
    }
    emit(event, ...args) {
        //event = eventName(event);
        const callArgs = [event].concat(args);
        super.emit(...callArgs);
    }
    // @ts-expect-error
    addListener(event, handler) {
        if (nativeSocketEvents[event]) {
            event = nativeSocketEvents[event];
            this.socket.on(event, handler);
        }
        else {
            // @ts-ignore
            super.addListener((0, event_name_js_1.eventName)(event), handler);
        }
        return () => { };
    }
    // @ts-expect-error
    removeListener(event, handler) {
        if (nativeSocketEvents[event]) {
            event = nativeSocketEvents[event];
            this.socket.removeListener(event, handler);
        }
        else {
            // @ts-ignore
            super.removeListener((0, event_name_js_1.eventName)(event), handler);
        }
    }
}
Connection.prototype.on = Connection.prototype.addListener;
/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaWebSocketsServer extends index_js_1.LiveReplicaServer {
    constructor(wsServer, options) {
        super(options);
        if (!wsServer) {
            return;
        }
        wsServer.on('connection', (socket) => this.handleWebSocket(socket));
    }
    handleWebSocket(socket) {
        const connection = new Connection(socket);
        const unHandle = this.onConnect(connection);
        const onDecodingError = () => socket.terminate();
        connection.on('decoding-error', onDecodingError);
        return function stopHandlingSocket() {
            unHandle();
            connection.removeListener('decoding-error', onDecodingError);
        };
    }
}
exports.LiveReplicaWebSocketsServer = LiveReplicaWebSocketsServer;
exports.default = LiveReplicaWebSocketsServer;
//# sourceMappingURL=ws-server.js.map