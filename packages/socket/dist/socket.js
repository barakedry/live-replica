"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveReplicaSocket = void 0;
const event_name_1 = require("../common/event-name");
class LiveReplicaSocket {
    constructor(baseSocket) {
        this._socket = baseSocket;
        this._instance = LiveReplicaSocket.instances++;
    }
    send(event, payload, ack) {
        return this._socketSend((0, event_name_1.eventName)(event), payload, ack);
    }
    on(event, fn) {
        this._addSocketEventListener((0, event_name_1.eventName)(event), fn);
    }
    once(event, fn) {
        this._addSocketEventListenerOnce((0, event_name_1.eventName)(event), fn);
    }
    off(event, fn) {
        this._removeSocketEventListener((0, event_name_1.eventName)(event), fn);
    }
    /**
     * Overrides
     */
    get baseSocket() {
        return this._socket;
    }
    _addSocketEventListener(eventName, fn) {
        this._socket.on(eventName, fn);
    }
    _addSocketEventListenerOnce(eventName, fn) {
        this._socket.once(eventName, fn);
    }
    _removeSocketEventListener(eventName, fn) {
        this._socket.removeListener(eventName, fn);
    }
    _socketSend(eventName, payload, ack) {
        return new Promise((resolve) => {
            this._socket.emit(eventName, payload, (...args) => {
                ack?.(...args);
                if (args.length === 1) {
                    resolve(args[0]);
                }
                else {
                    resolve(args);
                }
            });
        });
    }
    connect(baseSocket) {
        this._socket = baseSocket;
        if (!this.isConnected() && this._socket.connect) {
            this._socket.connect();
        }
    }
    disconnect() {
        if (this._socket.disconnect) {
            this._socket.disconnect();
        }
        // @ts-ignore
        delete this._socket;
    }
    isConnected() { return false; }
}
exports.LiveReplicaSocket = LiveReplicaSocket;
LiveReplicaSocket.instances = 0;
exports.default = LiveReplicaSocket;
//# sourceMappingURL=socket.js.map