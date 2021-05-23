/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const eventName = require('../common/events');
const { EventEmitter }  = require('events');
const LiveReplicaServer = require('../server');
const cluster = require('cluster');

class Connection extends EventEmitter {
    constructor(worker) {
        super();

        this.setMaxListeners(50000);

        this.socket = worker;
        this.messageFromWorkerProcess = (msg) => {
            if (typeof msg !== 'object' || !msg.liveReplica) {
                return;
            }

            const {event, payload, ack} = msg.liveReplica;

            let ackFunction;
            if (ack) {
                ackFunction = (...args)=> {
                    this.send(ack, ...args);
                }
            }

            this.emit(event, payload, ackFunction);
        };

        this.socket.on('message', this.messageFromWorkerProcess);
    }


    send(event, ...args) {
        event = eventName(event);
        this.socket.send({
            liveReplica: {
                event,
                args
            }
        });
    }


    emit(event, ...args) {
        event = eventName(event);
        const callArgs = [event].concat(args);
        super.emit.apply(this, callArgs);
    }

    addEventListener(event, handler) {
        this.socket.on(eventName(event), handler);
    }

    removeListener(event, handler) {
        this.socket.removeListener(eventName(event), handler);
    }

}

/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaNodeClusterServer extends LiveReplicaServer {
    constructor() {
        if (!cluster.isMaster) {
            throw new Error('LiveReplicaNodeClusterServer can be initiated only on a node.js cluster master process')
        }

        super();

        cluster.on('online', (worker) => {
            this.onConnect(new Connection(worker));
        });

    }

}

module.exports = LiveReplicaNodeClusterServer;