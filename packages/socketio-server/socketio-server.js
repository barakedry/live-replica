/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const eventName = require('../common/events');
const { EventEmitter }  = require('events');
const LiveReplicaServer = require('../server');

class Connection extends EventEmitter {
    constructor(socketio, options) {
        super(options);

        this.socket = socketio;

        this.setMaxListeners(50000);

    }


    send(event, payload) {
        event = eventName(event);
        this.socket.emit(event, payload);
    }

    addListener(event, handler) {
        this.socket.on(eventName(event), handler);
    }

    removeListener(event, handler) {
        this.socket.removeListener(eventName(event), handler);
    }

}

Connection.prototype.on = Connection.prototype.addListener;

/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaSocketIoServer extends LiveReplicaServer {
    constructor(sioServer) {
        super();

        sioServer.on('connect', (socket) => {
            console.info(`LiveReplicaSocketIoServer - new socket.io connection ${socket.id}`);
            this.onConnect(new Connection(socket));
        });
    }

}

module.exports = LiveReplicaSocketIoServer;