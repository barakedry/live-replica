/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const LiveReplicaEvents = require('../common/events');

/**
 *  LiveReplicaSocket
 */
class LiveReplicaSocket {

    constructor(baseSocket) {
        this._instance = LiveReplicaSocket.instances++;
    }

    eventName(event) {
        let eventName = LiveReplicaEvents[event] || event;
        return `${eventName}.${this._instance}`;
    }

    send(event, payload, ack) {
        const eventName = this.eventName(event);
        this._socketSend(eventName, payload, ack);
    }

    on(event, fn) {
        this._addSocketEventListener(this.eventName(event), fn)
    }

    off(event, fn) {
        this._removeSocketEventListener(this.eventName(event), fn)
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

    _removeSocketEventListener(eventName, fn) {
        this._socket.removeEventListener(eventName, fn);
    }

    _socketSend(eventName, payload, ack) {
        this._socket.send(eventName, payload, ack);
    }

    connect(baseSocket) {

        this._socket = baseSocket;

        if (!this.isConnected()) {
            this._socket.connect();
        }
    }

    disconnect() {
        this._socket.disconnect();
    }

    isConnected() { return false; }
}

LiveReplicaSocket.instances = 0;

module.exports = LiveReplicaSocket;