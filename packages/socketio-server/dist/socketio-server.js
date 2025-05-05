"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveReplicaSocketIoServer = void 0;
const event_name_1 = require("../common/event-name");
const events_1 = require("../events/events");
const index_1 = require("../server/index");
class Connection extends events_1.EventEmitter {
    constructor(socketio) {
        super();
        this.socket = socketio;
        this.setMaxListeners(50000);
    }
    send(event, ...args) {
        event = (0, event_name_1.eventName)(event);
        this.socket.emit(event, ...args);
    }
    // @ts-expect-error
    addListener(event, handler) {
        this.socket.on((0, event_name_1.eventName)(event), handler);
    }
    // @ts-expect-error
    removeListener(event, handler) {
        this.socket.removeListener((0, event_name_1.eventName)(event), handler);
    }
}
// @ts-expect-error
Connection.prototype.on = Connection.prototype.addListener;
/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaSocketIoServer extends index_1.LiveReplicaServer {
    constructor(sioServer) {
        // @ts-expect-error
        super();
        sioServer.on('connect', (socket) => {
            console.info(`LiveReplicaSocketIoServer - new socket.io connection ${socket.id}`);
            this.onConnect(new Connection(socket));
        });
    }
}
exports.LiveReplicaSocketIoServer = LiveReplicaSocketIoServer;
exports.default = LiveReplicaSocketIoServer;
//# sourceMappingURL=socketio-server.js.map