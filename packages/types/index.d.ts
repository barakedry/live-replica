// @live-replica/live-replica.d.ts

declare module '@live-replica/live-replica' {
    export type EventListener = (...args) => void;

    export class EventEmitter {
        setMaxListeners(num: number);

        on(eventName: string, cb: EventListener);

        addEventListener(eventName: string, cb: EventListener);

        addListener(eventName: string, cb: EventListener);

        off(eventName: string, cb: EventListener);

        removeEventListener(eventName: string, cb: EventListener);

        removeListener(eventName: string, cb: EventListener);

        once(eventName: string, cb: EventListener);

        emit(eventName, ...args);

        removeAllListeners(eventName: string);

        listenersOf(eventName: string): EventListener[]

        listenerCount(eventName: string): number

    }

    export type KeyList = string[] | Set<string>;

    export type DiffInfo = {
        snapshot?: boolean;
        hasAdditions?: boolean;
        hasAddedObjects?: boolean;
        hasDeletions?: boolean;
        hasUpdates?: boolean;
        hasDifferences?: boolean;
        additions?: object | Array<object>,
        deletions?: object,
        updates?: object,
        addedObjects?: object,
        differences?: object | Array<object>,
    }

    export type SubscribeCallback = (differencesOrSnapshot?: object, changeInfo?: DiffInfo) => void;
    export type UnsubscribeCallback = () => void;
    export type SpliceParams = { index: number, itemsToRemove: number, itemsToAdd?: Array<any> }

    export class PatchDiff extends EventEmitter {
        apply(patch: object, path?: string, options?: object);

        set(fullDocument: object, path?: string, options?: object);

        remove(path?: string, options?: object);

        splice(spliceParams: SpliceParams, path?: string, options?: object);

        get(path?: string, callback?: (data: object) => void);
        get(callback?: (data: object) => void);

        getClone(path?: string): object;

        subscribe(path: string, callback?: SubscribeCallback): UnsubscribeCallback;
        subscribe(callback: SubscribeCallback): UnsubscribeCallback;

        whitelist(keys: KeyList);

        getWhenExists(path?: string): Promise<object>;

        whenAnything(path?: string): Promise<object>;

        at(subPath, cached?): PatchDiff;

        getFullPath(subPath?: string): string;

        get data(): Proxy;

        getData(proxyOptions?: Partial<ProxyOptions>): Proxy
    }


    export type Proxy = object;
    export type ProxyOptions = { immediateFlush: boolean }


    export class Origin extends PatchDiff {
        get data(): Proxy;
    }

    export type SubscriptionRequest = ReplicaPermissions & {
        path: string;
        readTransformer?: (data: any, part?: PatchDiff) => any;
        writeTransformer?: (data: any, part?: PatchDiff) => any;
        whitelist?: KeyList;
        target?: Origin;
        params?: object,
        [key: string]: any;
    }

    export type Middleware = (request: SubscriptionRequest, reject: (reason: string) => void, next: (request: SubscriptionRequest) => void) => void;

    export class Server extends PatchDiff {

        use(middleware: Middleware);

        at(subPath): Origin;
    }


    export class Socket<SocketType> {
        constructor(socket: SocketType);

        set socket(socket: SocketType);

        get baseSocket(): SocketType;

        disconnect();

        isConnected(): boolean

        connect(baseSocket: SocketType);

        disconnect();

        isConnected(): boolean;
    }

    export type ReplicaPermissions = { allowWrite: boolean, allowRPC: boolean };
    export type ReplicaOptions = ReplicaPermissions & {
        dataObject: object,
        params?: object,
        subscribeRemoteOnCreate: boolean,
        connection: Socket<any>
    }

    export class Replica extends PatchDiff {
        constructor(remotePath: string, options: Partial<ReplicaOptions>);

        public remotePath: string;

        at(subPat: string): Replica;

        subscribed: Promise<any>;
        synced: Promise<any>;

        subscribeRemote(connection: Socket<any>, subscribeSuccessCallback: Function, subscribeRejectCallback: Function)

        unsubscribeRemote();

        reset(): Promise<any>;

        destroy();
    }

    export class WebSocketClient extends Socket<WebSocket> {
    }

    export class WebSocketServer extends Server {
        handleWebSocket(socket);
    }

    export class PatcherProxy {
        public static isProxy(proxy): boolean;

        public static unwrap(proxy): object;

        public static getPatchDiff(proxy): PatchDiff;

        public static create(patcher: PatchDiff, path: string, root?: PatchDiff, readonly?: boolean, immediateFlush?: boolean);
    }

    export type ApplyOptions = {
        emitEvents?: boolean
        maxKeysInLevel?: 1000,
        maxLevels?: 50,
        maxListeners?: 1000000
    };

    export type LiveReplicaProxy = object;

    export function observe(object: LiveReplicaProxy, cb: SubscribeCallback): UnsubscribeCallback;

    export function subscribe(object: LiveReplicaProxy, cb: SubscribeCallback): UnsubscribeCallback;

    export function unwrap(object: LiveReplicaProxy): object;

    export function nextChange(object: LiveReplicaProxy): Promise<Partial<object>>;

    export function replace(object: LiveReplicaProxy, value: object): LiveReplicaProxy;

    export function get(object: LiveReplicaProxy, path?): any;

    export function cloneDeep(object: LiveReplicaProxy, path?): object;

    export function set(object: LiveReplicaProxy, path: string, value: object);

    export function merge(object: LiveReplicaProxy, partial: object);


    export type ObservedOptions = {
        onChange: string; // on change method name on the class
    }

    export function observed(options: ObservedOptions); // decorator
}