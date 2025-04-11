import { EventEmitter } from '../events/events.js';
import { LiveReplicaSocket } from '../socket/socket.js';

let acks = 1;

/**
 * A LiveReplica socket implementation for MessageChannel communication
 * Allows direct communication between threads using MessagePort
 */
export class MessageChannelSocket extends LiveReplicaSocket {
    /**
     * Creates a new MessageChannelSocket
     */
    constructor() {
        super();
        this._emitter = new EventEmitter();
        this._emitter.setMaxListeners(50000);
    }

    // Override base class methods

    _addSocketEventListener(eventName, fn) {
        this._emitter.on(eventName, fn);
    }

    _addSocketEventListenerOnce(eventName, fn) {
        this._emitter.once(eventName, fn);
    }

    _removeSocketEventListener(eventName, fn) {
        this._emitter.removeListener(eventName, fn);
    }

    _socketSend(event, payload, ack) {
        if (!this.port) {
            throw new Error('MessagePort not connected');
        }

        let ackEvent;
        if (ack) {
            ackEvent = `lr-acks::${++acks}`;
            this.once(ackEvent, ack);
        }

        const message = {
            liveReplica: {
                event,
                payload,
                ack: ackEvent,
            }
        };

        this.port.postMessage(message);
    }

    get baseSocket() {
        return this.port;
    }

    /**
     * Connects to a MessagePort
     * @param {MessagePort} port The MessagePort to connect to
     */
    connect(port) {
        if (this.port === port) {
            return;
        }

        if (this.port && this.onPortMessage) {
            this.port.removeEventListener('message', this.onPortMessage);
        }

        this.port = port;

        this.onPortMessage = ({ data }) => {
            if (data.liveReplica) {
                const { event, args } = data.liveReplica;
                this._emitter.emit(event, ...(args || []));
            }
        };

        this.port.addEventListener('message', this.onPortMessage);

        // Ensure the port is started
        if (port.start && typeof port.start === 'function') {
            port.start();
        }
    }

    /**
     * Disconnects from the MessagePort
     */
    disconnect() {

        this.send('disconnect');

        if (this.port && this.onPortMessage) {
            this.port.removeEventListener('message', this.onPortMessage);
        }

        delete this.port;
    }

    /**
     * Checks if the socket is connected
     * @returns {boolean} True if connected, false otherwise
     */
    isConnected() {
        return !!this.port;
    }

    /**
     * Posts a raw message to the port
     * @param {any} message The message to post
     * @param {Transferable[]} [transfer] Transferable objects to transfer
     */
    postMessage(message, transfer) {
        if (!this.port) {
            throw new Error('MessagePort not connected');
        }

        if (transfer) {
            this.port.postMessage(message, transfer);
        } else {
            this.port.postMessage(message);
        }
    }
}

export default MessageChannelSocket;