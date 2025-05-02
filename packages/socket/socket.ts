import { eventName } from "../common/event-name";

export interface BaseSocket {
    on(event: string, fn: (...args: any[]) => void): void;
    once(event: string, fn: (...args: any[]) => void): void;
    removeListener(event: string, fn: (...args: any[]) => void): void;
    emit(event: string, payload: any, ack?: (...args: any[]) => void): void;
    connect?(): void;
    disconnect?(): void;
}

export class LiveReplicaSocket {
    private _socket: BaseSocket;
    private _instance: number;
    static instances = 0;

    constructor(baseSocket: BaseSocket) {
        this._socket = baseSocket;
        this._instance = LiveReplicaSocket.instances++;
    }

    send(event: string, payload: any, ack?: (...args: any[]) => void): Promise<any> {
        return this._socketSend(eventName(event), payload, ack);
    }

    on(event: string, fn: (...args: any[]) => void): void {
        this._addSocketEventListener(eventName(event), fn);
    }

    once(event: string, fn: (...args: any[]) => void): void {
        this._addSocketEventListenerOnce(eventName(event), fn);
    }

    off(event: string, fn: (...args: any[]) => void): void {
        this._removeSocketEventListener(eventName(event), fn);
    }

    /**
     * Overrides
     */

    get baseSocket(): BaseSocket {
        return this._socket;
    }

    private _addSocketEventListener(eventName: string, fn: (...args: any[]) => void): void {
        this._socket.on(eventName, fn);
    }
    private _addSocketEventListenerOnce(eventName: string, fn: (...args: any[]) => void): void {
        this._socket.once(eventName, fn);
    }

    private _removeSocketEventListener(eventName: string, fn: (...args: any[]) => void): void {
        this._socket.removeListener(eventName, fn);
    }

    private _socketSend(eventName: string, payload: any, ack?: (...args: any[]) => void): Promise<any> {
        return new Promise((resolve) => {
            this._socket.emit(eventName, payload, (...args: any[]) => {
                ack?.(...args);
                if (args.length === 1) {
                    resolve(args[0]);
                } else {
                    resolve(args);
                }
            });
        });
    }

    connect(baseSocket: BaseSocket): void {
        this._socket = baseSocket;
        if (!this.isConnected() && this._socket.connect) {
            this._socket.connect();
        }
    }

    disconnect(): void {
        if (this._socket.disconnect) {
            this._socket.disconnect();
        }
        // @ts-ignore
        delete this._socket;
    }

    isConnected(): boolean { return false; }
}

export default LiveReplicaSocket; 