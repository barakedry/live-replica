/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const LiveReplicaEvents = require('../common/events');
const { EventEmitter }  = require('events');
const LiveReplicaServer = require('@live-replica/server');


class Socket extends EventEmitter {
    constructor() {
        this.messageFromMaster = ({data}) => {
            if (data.liveReplica) {
                const {event, payload, ack} = data.liveReplica;
                this.emit(event, payload, ack);
            }
        };

        global.addEventListener('onMessage', this.messageFromMaster);
    }

    eventName(event) {
        return LiveReplicaEvents[event] || event;
    }

    send(event, payload) {
        event = this.eventName(event);
        global.postMessage({
            liveReplica: {
                event,
                payload
            }
        });
    }


    emit(eventName, ...args) {
        eventName = this.eventName(eventName);
        const callArgs = [eventName].concat(args);
        super.emit.apply(this, callArgs);
    }

    addEventListener(eventName, handler) {
        eventName = this.eventName(eventName);
        super.addEventListener(eventName, handler);
    }

    removeEventListener(eventName, handler) {
        eventName = this.eventName(eventName);
        super.removeEventListener(eventName, handler);
    }

}

/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaWorkerServer extends LiveReplicaServer {
    constructor() {
        if (typeof onmessage !== 'function') {
            throw new Error('LiveReplicaWorkerServer can be initiated only inside a web worker')
        }
        super();

        this._soleSocket = new Socket();
        this.onConnect(this._soleSocket)
    }

}

module.exports = LiveReplicaWorkerServer;