"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveReplicaSocketIoClient = void 0;
const socket_1 = require("../socket/socket");
/**
 *  LiveReplicaSocketIoClient
 */
class LiveReplicaSocketIoClient extends socket_1.LiveReplicaSocket {
    // overrides
    isConnected() { return !!this.baseSocket; }
}
exports.LiveReplicaSocketIoClient = LiveReplicaSocketIoClient;
//# sourceMappingURL=socketio-client.js.map