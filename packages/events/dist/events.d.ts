export declare const PATH_EVENT_PREFIX = "$path#";
export type EventListener = (...args: any[]) => void;
export declare class EventEmitter {
    private listeners;
    private maxListeners;
    addEventListener: (event: string, cb: EventListener) => () => void;
    addListener: (event: string, cb: EventListener) => () => void;
    removeEventListener: (event: string, cb: EventListener) => void;
    removeListener: (event: string, cb: EventListener) => void;
    setMaxListeners(num: number): void;
    get listenedPaths(): string[];
    on(event: string, cb: EventListener): () => void;
    off(event: string, cb: EventListener): void;
    removeAllListeners(event: string): void;
    listenersOf(event: string): EventListener[];
    listenerCount(event: string): number;
    once(event: string, cb: EventListener): void;
    emit(event: string, ...args: any[]): void;
}
//# sourceMappingURL=events.d.ts.map