import { eventName } from '@live-replica/common';

export interface BaseSocket {
    on(event: string, fn: (...args: any[]) => void): void;
    once(event: string, fn: (...args: any[]) => void): void;
    removeListener(event: string, fn: (...args: any[]) => void): void;
    emit(event: string, payload: any, ack?: (...args: any[]) => void): void;
    connect(): void;
    disconnect(): void;
}

export class LiveReplicaSocket {
    private static instances: number = 0;
    private _socket?: BaseSocket;
    private _instance: number;

    constructor(baseSocket: BaseSocket) {
        this._socket = baseSocket;
        this._instance = LiveReplicaSocket.instances++;
    }

    send(event: string, payload?: any, ack?: (...args: any[]) => void): Promise<any> {
        if (!this._socket) throw new Error('Socket not connected');
        return this._socketSend(eventName(event), payload, ack);
    }

    on(event: string, fn: (...args: any[]) => void): void {
        if (!this._socket) throw new Error('Socket not connected');
        this._addSocketEventListener(eventName(event), fn);
    }

    once(event: string, fn: (...args: any[]) => void): void {
        if (!this._socket) throw new Error('Socket not connected');
        this._addSocketEventListenerOnce(eventName(event), fn);
    }

    off(event: string, fn: (...args: any[]) => void): void {
        if (!this._socket) throw new Error('Socket not connected');
        this._removeSocketEventListener(eventName(event), fn);
    }

    get baseSocket(): BaseSocket | undefined {
        return this._socket;
    }

    protected _addSocketEventListener(eventName: string, fn: (...args: any[]) => void): void {
        if (!this._socket) throw new Error('Socket not connected');
        this._socket.on(eventName, fn);
    }

    protected _addSocketEventListenerOnce(eventName: string, fn: (...args: any[]) => void): void {
        if (!this._socket) throw new Error('Socket not connected');
        this._socket.once(eventName, fn);
    }

    protected _removeSocketEventListener(eventName: string, fn: (...args: any[]) => void): void {
        if (!this._socket) throw new Error('Socket not connected');
        this._socket.removeListener(eventName, fn);
    }

    protected _socketSend(eventName: string, payload: any, ack?: (...args: any[]) => void): Promise<any> {
        if (!this._socket) throw new Error('Socket not connected');
        return new Promise((resolve) => {
            this._socket!.emit(eventName, payload, (...args: any[]) => {
                ack?.(...args);
                resolve(args[0]);
            });
        });
    }

    connect(baseSocket: BaseSocket): void {
        this._socket = baseSocket;

        if (!this.isConnected()) {
            this._socket.connect();
        }
    }

    disconnect(): void {
        if (!this._socket) return;
        this._socket.disconnect();
        this._socket = undefined;
    }

    isConnected(): boolean {
        return !!this._socket;
    }
} 