export declare const PATH_EVENT_PREFIX = "$path#";
type EventCallback = (...args: any[]) => void;
export declare class EventEmitter {
    private listeners;
    private maxListeners;
    addEventListener: (event: string, cb: EventCallback) => () => void;
    addListener: (event: string, cb: EventCallback) => () => void;
    removeEventListener: (event: string, cb: EventCallback) => void;
    removeListener: (event: string, cb: EventCallback) => void;
    setMaxListeners(num: number): void;
    get listenedPaths(): string[];
    on(event: string, cb: EventCallback): () => void;
    off(event: string, cb: EventCallback): void;
    removeAllListeners(event: string): void;
    listenersOf(event: string): EventCallback[];
    listenerCount(event: string): number;
    once(event: string, cb: EventCallback): void;
    emit(event: string, ...args: any[]): void;
}
export {};
//# sourceMappingURL=events.d.ts.map