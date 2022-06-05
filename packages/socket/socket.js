import { eventName } from "../common/event-name.js";
export class LiveReplicaSocket {

    constructor(baseSocket) {
        this._socket = baseSocket;
        this._instance = LiveReplicaSocket.instances++;
    }

    send(event, payload, ack) {
        this._socketSend(eventName(event), payload, ack);
    }

    on(event, fn) {
        this._addSocketEventListener(eventName(event), fn)
    }

    once(event, fn) {
        this._addSocketEventListenerOnce(eventName(event), fn)
    }

    off(event, fn) {
        this._removeSocketEventListener(eventName(event), fn)
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
        this._socket.emit(eventName, payload, ack);
    }

    connect(baseSocket) {

        this._socket = baseSocket;

        if (!this.isConnected()) {
            this._socket.connect();
        }
    }

    disconnect() {
        this._socket.disconnect();
        delete this._socket;
    }

    isConnected() { return false; }
}

LiveReplicaSocket.instances = 0;

export default LiveReplicaSocket;