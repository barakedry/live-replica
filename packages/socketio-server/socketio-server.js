import { eventName } from "../common/event-name.js";
import { EventEmitter } from '@live-replica/events';
import { LiveReplicaServer } from '@live-replica/server';

class Connection extends EventEmitter {
    constructor(socketio, options) {
        super(options);

        this.socket = socketio;

        this.setMaxListeners(50000);

    }


    send(event, ...args) {
        event = eventName(event);
        this.socket.emit(event, ...args);
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
export class LiveReplicaSocketIoServer extends LiveReplicaServer {
    constructor(sioServer) {
        super();

        sioServer.on('connect', (socket) => {
            console.info(`LiveReplicaSocketIoServer - new socket.io connection ${socket.id}`);
            this.onConnect(new Connection(socket));
        });
    }

}

export default LiveReplicaSocketIoServer;