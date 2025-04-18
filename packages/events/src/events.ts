type EventListener = (...args: any[]) => void;

interface EventListeners {
    [event: string]: EventListener[];
}

export const PATH_EVENT_PREFIX = 'path:';
const PATH_EVENT_PREFIX_LENGTH = PATH_EVENT_PREFIX.length;

export class EventEmitter {
    private listeners: EventListeners = {};
    private maxListeners: number = 10;

    // Implement alias methods directly in the class
    addEventListener(event: string, cb: EventListener): () => void {
        return this.on(event, cb);
    }

    addListener(event: string, cb: EventListener): () => void {
        return this.on(event, cb);
    }

    removeEventListener(event: string, cb: EventListener): void {
        this.off(event, cb);
    }

    removeListener(event: string, cb: EventListener): void {
        this.off(event, cb);
    }

    setMaxListeners(num: number): void { 
        this.maxListeners = num; 
    }

    getMaxListeners(): number { 
        return this.maxListeners; 
    }

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
            console.warn(`MaxListenersExceededWarning: Possible EventEmitter memory leak detected. ${this.listeners[event].length} ${event} listeners added. Use emitter.setMaxListeners() to increase limit`);
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

    once(event: string, cb: EventListener): () => void {
        const wrappedCb = (...args: any[]) => {
            this.off(event, wrappedCb);
            cb.apply(this, args);
        };
        return this.on(event, wrappedCb);
    }

    emit(event: string, ...args: any[]): void {
        this.listeners[event]?.forEach(listener => listener.call(this, ...args));
    }
}