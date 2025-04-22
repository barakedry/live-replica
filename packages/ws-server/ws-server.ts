import { WebSocket, WebSocketServer } from 'ws';
import { eventName } from "../common/event-name.js";
import { EventEmitter } from "../events/events.js";
import { LiveReplicaServer } from '../server/index.js';
import { encode, decode } from '@msgpack/msgpack';

const LIVE_REPLICA_MSG = '$LR';
const nativeSocketEvents: Record<string, string> = {'disconnect': 'close'};

interface LiveReplicaMessage {
    [LIVE_REPLICA_MSG]: {
        event: string;
        payload?: any;
        args?: any[];
        ack?: string;
    };
}

class Connection extends EventEmitter {
    private socket: WebSocket;

    constructor(ws: WebSocket) {
        super();

        this.setMaxListeners(50000);

        this.socket = ws;
        this.socket.setMaxListeners?.(50000);

        this.socket.addEventListener('message', ({data}) => {
            try {
                const msg = decode(data as ArrayBuffer) as LiveReplicaMessage;
                if (msg[LIVE_REPLICA_MSG]) {
                    const {event, payload, ack} = msg[LIVE_REPLICA_MSG];
                    let ackFunction: ((...args: any[]) => void) | undefined;
                    if (ack) {
                        ackFunction = (...args: any[]) => {
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

    send(event: string, ...args: any[]): void {
        event = eventName(event);

        const message: LiveReplicaMessage = {
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

    emit(event: string, ...args: any[]): boolean {
        const callArgs = [event].concat(args);
        return super.emit.apply(this, callArgs);
    }

    addListener(event: string, handler: (...args: any[]) => void): this {
        if (nativeSocketEvents[event]) {
            event = nativeSocketEvents[event];
            this.socket.on?.(event, handler);
        } else {
            super.addListener(eventName(event), handler);
        }
        return this;
    }

    removeListener(event: string, handler: (...args: any[]) => void): this {
        if (nativeSocketEvents[event]) {
            event = nativeSocketEvents[event];
            this.socket.removeListener?.(event, handler);
        } else {
            super.removeListener(eventName(event), handler);
        }
        return this;
    }

    on = this.addListener;
}

/**
 * WebSocket server implementation for LiveReplica
 */
export class LiveReplicaWebSocketsServer extends LiveReplicaServer {
    constructor(wsServer: WebSocketServer, options?: any) {
        super(options);

        if (!wsServer) { return; }

        wsServer.on('connection', (socket: WebSocket) => this.handleWebSocket(socket));
    }

    handleWebSocket(socket: WebSocket): () => void {
        const connection = new Connection(socket);
        const unHandle = this.onConnect(connection);
        const onDecodingError = () => socket.terminate();
        connection.on('decoding-error', onDecodingError);
        return function stopHandlingSocket() {
            unHandle();
            connection.removeListener('decoding-error', onDecodingError);
        }
    }

    // PatchDiff methods
    set(data: any, path?: string): void {
        super.set(data, path);
    }

    get(path?: string): any {
        return super.get(path);
    }

    getWhenExists(path: string): Promise<any> {
        return super.getWhenExists(path);
    }
}

export default LiveReplicaWebSocketsServer; 