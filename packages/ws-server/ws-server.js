/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const eventName = require('../common/events');
const { EventEmitter }  = require('events');
const LiveReplicaServer = require('../server');
const msgpack = require('@msgpack/msgpack');
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
                const msg = msgpack.decode(data);
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
                    this.emit('unkown-message', msg);
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

        const data = msgpack.encode(message);
        this.socket.send(data);
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
class LiveReplicaWebSocketsServer extends LiveReplicaServer {
    constructor(wsServer) {
        super();

        wsServer.on('connection', (socket) => {
            console.info(`LiveReplicaWebSocketsServer - new web socket connection ${socket}`);
            const connection = new Connection(socket);
            this.onConnect(connection);
            connection.on('decoding-error', () => socket.terminate());
        });
    }

}

module.exports = LiveReplicaWebSocketsServer;
