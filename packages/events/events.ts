export const PATH_EVENT_PREFIX = '$path#';
const PATH_EVENT_PREFIX_LENGTH = PATH_EVENT_PREFIX.length;

export type EventListener = (...args: any[]) => void;

type ListenerMap = {
    [event: string]: EventListener[];
};

export class EventEmitter {
    private listeners: ListenerMap = {};
    private maxListeners = 10;

    // Prototype method declarations for compatibility
    addEventListener!: (event: string, cb: EventListener) => () => void;
    public addListener!: (event: string, cb: EventListener) => () => void;
    removeEventListener!: (event: string, cb: EventListener) => void;
    removeListener!: (event: string, cb: EventListener) => void;

    setMaxListeners(num: number): void { this.maxListeners = num; }

    get listenedPaths(): string[] {
        return Object.keys(this.listeners)
            .filter(e => e.startsWith(PATH_EVENT_PREFIX))
            .map(eventName => eventName.substring(PATH_EVENT_PREFIX_LENGTH))
            .reverse();
    }

    on(event: string, cb: EventListener): () => void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }

        if (this.listeners[event].length >= this.maxListeners) {
            console.warn(`EventEmitter, possible memory leak. number listeners of event ${event} exceeds ${this.maxListeners}`);
        }

        this.listeners[event].push(cb);
        return () => this.off(event, cb);
    }

    off(event: string, cb: EventListener): void {
        if (!this.listeners[event]) return;

        const index = this.listeners[event].indexOf(cb);
        if (index !== -1) {
            this.listeners[event].splice(index, 1);
        }

        if (this.listeners[event].length === 0) {
            delete this.listeners[event];
        }
    }

    removeAllListeners(event: string): void {
        delete this.listeners[event];
    }

    listenersOf(event: string): EventListener[] {
        return this.listeners[event] ? [...this.listeners[event]] : [];
    }

    listenerCount(event: string): number {
        return this.listeners[event]?.length || 0;
    }

    once(event: string, cb: EventListener): void {
        const off = this.on(event, (...args) => {
            off?.();
            cb.call(this, ...args);
        });
    }

    emit(event: string, ...args: any[]): void {
        this.listeners[event]?.forEach(listener => listener.call(this, ...args));
    }
}

EventEmitter.prototype.addEventListener = EventEmitter.prototype.on;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;
EventEmitter.prototype.removeEventListener = EventEmitter.prototype.off;
EventEmitter.prototype.removeListener = EventEmitter.prototype.off; 