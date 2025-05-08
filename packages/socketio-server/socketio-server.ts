import { eventName } from "../common/event-name";
import { EventEmitter } from "../events/events";
import { LiveReplicaServer } from "../server/index";

class Connection extends EventEmitter {
    socket: any;

    constructor(socketio: any) {
        super();

        this.socket = socketio;

        this.setMaxListeners(50_000);

    }


    send(event: any, ...args: any[]) {
        event = eventName(event);
        this.socket.emit(event, ...args);
    }

    // @ts-expect-error
    addListener(event, handler) {
        this.socket.on(eventName(event), handler);
    }

    // @ts-expect-error
    removeListener(event, handler) {
        this.socket.removeListener(eventName(event), handler);
    }

}

// @ts-expect-error
Connection.prototype.on = Connection.prototype.addListener;

/**
 *  LiveReplicaWorkerSocket
 */
export class LiveReplicaSocketIoServer extends LiveReplicaServer {
    constructor(sioServer: any) {
        // @ts-expect-error
        super();

        sioServer.on('connect', (socket: any) => {
            console.info(`LiveReplicaSocketIoServer - new socket.io connection ${socket.id}`);
            this.onConnect(new Connection(socket));
        });
    }

}

export default LiveReplicaSocketIoServer;