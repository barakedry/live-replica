/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
import {Events as LiveReplicaEvents} from '../common';

/**
 *  LiveReplicaSocket
 */
class LiveReplicaSocket {

    constructor(baseSocket) {
        this._instance = LiveReplicaSocket.instances++;
        this._socket = baseSocket;
    }

    eventName(event) {
        let eventName = LiveReplicaEvents[event] || event;
        return `${eventName}.${this._instance}`;
    }

    send(event, payload, ack) {
        const eventName = this.eventName(event);
        this.socketSend(eventName, payload, ack);
    }

    on(event, fn) {
        this.addSocketEventListener(this.eventName(event), fn)
    }

    off(event, fn) {
        this.removeSocketEventListener(this.eventName(event), fn)
    }

    get baseSocket() {
        return this._socket;
    }

    /**
     * Overrides
     */

    addSocketEventListener(eventName, fn) {
        this._socket.on(eventName, fn);
    }

    removeSocketEventListener(eventName, fn) {
        this._socket.removeEventListener(eventName, fn);
    }

    socketSend(eventName, payload, ack) {
        this._socket.send(eventName, payload, ack);
    }

    connect() {
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