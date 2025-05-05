import { eventName } from "../common/event-name";
export class LiveReplicaSocket {
    _socket;
    _instance;
    static instances = 0;
    constructor(baseSocket) {
        this._socket = baseSocket;
        this._instance = LiveReplicaSocket.instances++;
    }
    send(event, payload, ack) {
        return this._socketSend(eventName(event), payload, ack);
    }
    on(event, fn) {
        this._addSocketEventListener(eventName(event), fn);
    }
    once(event, fn) {
        this._addSocketEventListenerOnce(eventName(event), fn);
    }
    off(event, fn) {
        this._removeSocketEventListener(eventName(event), fn);
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
export default LiveReplicaSocket;
//# sourceMappingURL=socket.js.map