/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const LiveReplicaEvents = require('../common').Events;
const Events = require('events');
const LiveReplicaSocket = require('@live-replica/socket');

/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaWorkerSocket extends LiveReplicaSocket {


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

module.exports = LiveReplicaWorkerSocket;