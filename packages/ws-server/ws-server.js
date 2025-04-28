import {eventName} from "../common/event-name.js";
import { EventEmitter } from '@live-replica/events';
import {LiveReplicaServer} from '@live-replica/server';
import {encode, decode} from '../../node_modules/@msgpack/msgpack/dist.es5+esm/index.mjs';

const LIVE_REPLICA_MSG = '$LR';
const nativeSocketEvents = {'disconnect': 'close'};

class Connection extends EventEmitter {
    constructor(ws) {
        super();

        this.setMaxListeners(50000);

        this.socket = ws;
        this.socket.setMaxListeners(50000);

        this.socket.addEventListener('message', ({data}) => {
            try {
                const msg = decode(data);
                if (msg[LIVE_REPLICA_MSG]) {
                    const {event, payload, ack} = msg[LIVE_REPLICA_MSG];
                    let ackFunction;
                    if (ack) {
                        ackFunction = (...args)=> {
                            this.send(ack, ...args);
                        }
                    }

                    this.emit(event, payload, ackFunction);
                } else {
                    this.emit('unknown-message', msg);
                }
            } catch(e) {
                this.emit('decoding-error', e, data);
                console.error('[LiveReplica] unable to decode msgpack from socket', e );
            }
        });
    }


    send(event, ...args) {
        event = eventName(event);

        const message = {
            [LIVE_REPLICA_MSG]: {
                event,
                args
            }
        };

        try {
            const data = encode(message);
            this.socket.send(data);
        } catch (e) {
            console.error('[LiveReplica] unable to encode msgpack to socket', e );
        }
    }


    emit(event, ...args) {
        //event = eventName(event);
        const callArgs = [event].concat(args);
        super.emit.apply(this, callArgs);
    }

    addListener(event, handler) {
        if (nativeSocketEvents[event]) {
            event = nativeSocketEvents[event];
            this.socket.on(event, handler);
        } else {
            super.addListener(eventName(event), handler);
        }
    }

    removeListener(event, handler) {
        if (nativeSocketEvents[event]) {
            event = nativeSocketEvents[event];
            this.socket.removeListener(event, handler);
        } else {
            super.removeListener(eventName(event), handler);
        }
    }

}

Connection.prototype.on = Connection.prototype.addListener;

/**
 *  LiveReplicaWorkerSocket
 */
export class LiveReplicaWebSocketsServer extends LiveReplicaServer {

    constructor(wsServer, options) {
        super(options);

        if (!wsServer) { return; }

        wsServer.on('connection', (socket) => this.handleWebSocket(socket));
    }

    handleWebSocket(socket) {
        const connection = new Connection(socket);
        const unHandle = this.onConnect(connection);
        const onDecodingError = () => socket.terminate();
        connection.on('decoding-error', onDecodingError);
        return function stopHandlingSocket() {
            unHandle();
            connection.removeListener('decoding-error', onDecodingError);
        }
    }
}


export default LiveReplicaWebSocketsServer;
