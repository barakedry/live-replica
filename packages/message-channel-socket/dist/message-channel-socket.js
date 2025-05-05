"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageChannelSocket = void 0;
const events_1 = require("../events/events");
const socket_1 = require("../socket/socket");
let acks = 1;
/**
 * A LiveReplica socket implementation for MessageChannel communication
 * Allows direct communication between threads using MessagePort
 */
class MessageChannelSocket extends socket_1.LiveReplicaSocket {
    /**
     * Creates a new MessageChannelSocket
     */
    constructor() {
        // @ts-expect-error: LiveReplicaSocket expects a baseSocket argument
        super();
        this._emitter = new events_1.EventEmitter();
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
        this._emitter.removeEventListener(eventName, fn);
    }
    _socketSend(eventName, payload, ack) {
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
        return Promise.resolve();
    }
    // @ts-expect-error: baseSocket type mismatch with LiveReplicaSocket
    get baseSocket() {
        return this.port;
    }
    /**
     * Connects to a MessagePort
     * @param port The MessagePort to connect to
     */
    // @ts-expect-error: connect signature mismatch with LiveReplicaSocket
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
        // @ts-expect-error: send expects a payload argument
        this.send('disconnect');
        if (this.port && this.onPortMessage) {
            this.port.removeEventListener('message', this.onPortMessage);
        }
        delete this.port;
    }
    /**
     * Checks if the socket is connected
     * @returns True if connected, false otherwise
     */
    isConnected() {
        return !!this.port;
    }
    /**
     * Posts a raw message to the port
     * @param message The message to post
     * @param transfer Transferable objects to transfer
     */
    postMessage(message, transfer) {
        if (!this.port) {
            throw new Error('MessagePort not connected');
        }
        if (transfer) {
            this.port.postMessage(message, transfer);
        }
        else {
            this.port.postMessage(message);
        }
    }
}
exports.MessageChannelSocket = MessageChannelSocket;
exports.default = MessageChannelSocket;
//# sourceMappingURL=message-channel-socket.js.map