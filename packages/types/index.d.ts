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

    export type LiveReplicaProxy = object;
    export type Proxy<T> = T | LiveReplicaProxy;
    export type ProxyOptions = { readonly? : boolean, immediateFlush?: boolean }

    export type DeepPartial<T> = T extends object ? {
        [P in keyof T]?: DeepPartial<T[P]>;
    } : T;

    export type Patch<T> = DeepPartial<T> | string | undefined;

    /**
     * a callback to call when the data changes
     * this callback will be called once immediately after subscription with the current data as full snapshot and then with patches of the differences when the data changes
     * @param patchOrSnapshot a full snapshot or a patch of the differences
     * @param changeInfo information about the change
    *  @param context the context passed from mutating methods
     */
    export type SubscribeCallback<T> = (patchOrSnapshot?: Patch<T>, changeInfo?: DiffInfo, context?:any, deferred?:boolean) => void;
    export type UnsubscribeCallback = () => void;

    export type SpliceParams = { index: number, itemsToRemove: number, itemsToAdd?: Array<any> }

    export type MutationOptions = {
        defer?: boolean, // defers firing subscription callbacks to the next tick, useful when applying multiple mutations in a row, the last callback will be fired with aggregated patch of all mutations
        context?: any, // external context to pass to subscription callback when called
        [key: string]: any
    }

    export type MergeOptions = MutationOptions & {
        overrides?: {[path:string]: true}, // paths to override (replace) when merging a patch
    };

    type DifferencesPatch = object;

    /**
     * Manage a data object via interface of mutating methods such as apply, set, splice, remove
     * allows to subscribe to changes and apply patches to update the data object
     */
    export class PatchDiff<T> extends EventEmitter {

        /**
         * Merge a patch into the managed data object
         * @param patch a patch to merge
         * @param path (optional) a path to merge the patch into
         * @param options (optional) options for the merge
         * @returns a patch of the differences caused by the merge
         */
        apply(patch: Patch<T>, path?: string, options?: MergeOptions) : Patch<T>;


        /**
         * Set a value in the managed data object at a path
         * @param value the value to set (must be an object if path is not provided)
         * @param path (optional) a path to set the value at
         * @param options (optional) options for the set
         * @returns a patch of the differences caused by the set operation
         */
        set(value: any, path?: string, options?: MutationOptions) : Patch<T>;

        /**
         * Remove a value in the managed data object at a path
         * @param path (optional) a path to remove the value at
         * @param options (optional) options for the remove
         */
        remove(path?: string, options?: MutationOptions) : DifferencesPatch;

        /**
         * Splice an array in the managed data object at a path
         * @param spliceParams the splice parameters
         * @param path (optional) a path to the array to be spliced
         * @param options (optional) options for the splice
         * @returns a patch of the differences caused by the splice operation
         */
        splice(spliceParams: SpliceParams, path?: string, options?: MutationOptions);

        /**
         * Get a value from the managed data object at a path
         * @param path (optional) a path to get the value at
         * @returns the value at the path
         */
        get(path?: string, callback?: (data: object) => void);


        get(callback?: (data: object) => void);

        /**
         * Get a clone of the managed data object at a path
         * @param path (optional) a path to get the clone at
         * @returns a clone of the value at the path
         */
        getClone(path?: string): object;


        /**
         * Subscribe to changes in the managed data object at a path
         * @param path a path to subscribe to changes at
         * @param callback (optional) a callback to call when the data changes
         * @returns a function to unsubscribe
         */
        subscribe(path: string, callback?: SubscribeCallback<T>): UnsubscribeCallback;


        /**
         * Subscribe to changes in the managed data object
         * @param callback (optional) a callback to call when the data changes
         * @returns a function to unsubscribe
         */
        subscribe(callback: SubscribeCallback<T>): UnsubscribeCallback;


        /**
         * Returns a scoped PatchDiff at a relative path (uses this as its prototype object)
         * useful for working at a sub path of the managed data object and passing it around
         * @param subPath a relative path to scope the PatchDiff at
         * @param cached (optional) whether to return a cached PatchDiff for the sub path (default: true)
         */
        at(subPath, cached?): PatchDiff<any>;

        whitelist(keys: KeyList);

        getWhenExists(path?: string): Promise<any>;

        whenAnything(path?: string): Promise<any>;

        getFullPath(subPath?: string): string;

        get data(): Proxy<T>;
        getData(proxyOptions?: Partial<ProxyOptions>): Proxy<T>

        get root(): PatchDiff<any>;


    }


    export class Origin<T> extends PatchDiff<T> {
        get data(): Proxy<T>;
    }

    export type SubscriptionRequest = ReplicaPermissions & {
        path: string;
        readTransformer?: (data: Patch<any>, scope?: PatchDiff<any>) => Patch<any>;
        writeTransformer?: (data: Patch<any>, scope?: PatchDiff<any>) => Patch<any>;
        whitelist?: KeyList;
        target?: Origin<any>;
        params?: object,
        [key: string]: any;
    }

    export type Middleware = (request: SubscriptionRequest, reject: (reason: string) => void, next: (request: SubscriptionRequest) => void) => void;

    export class Server<T> extends PatchDiff<T> {

        use(middleware: Middleware);

        at(subPath): Origin<any>;
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

    export class Replica<T> extends PatchDiff<T> {

        static create(initObject: object, options: ReplicaOptions): LiveReplicaProxy;

        constructor(remotePath: string, options: Partial<ReplicaOptions>);

        public remotePath: string;

        at(subPat: string): Replica<any>;

        subscribed: Promise<any>;

        synced: Promise<any>;

        subscribeRemote(connection: Socket<any>, subscribeSuccessCallback: Function, subscribeRejectCallback: Function)

        unsubscribeRemote();

        reset(): Promise<any>;

        destroy();
    }

    export class WebSocketClient extends Socket<WebSocket> {
    }

    export class WebSocketServer extends Server<any> {
        handleWebSocket(socket);
    }

    export type ApplyOptions = {
        emitEvents?: boolean
        maxKeysInLevel?: 1000,
        maxLevels?: 50,
        maxListeners?: 1000000
    };

    export function hasProxy(value:any): boolean;

    export function getProxy(value:any): LiveReplicaProxy;

    export function isProxy(value:any): boolean;

    export function getPatchDiff(proxy: LiveReplicaProxy): PatchDiff<any>;

    export function observe(object: LiveReplicaProxy, cb: SubscribeCallback<any>): UnsubscribeCallback;

    export function subscribe(object: LiveReplicaProxy, cb: SubscribeCallback<any>): UnsubscribeCallback;

    export function unwrap(object: LiveReplicaProxy): object;

    export function nextChange(object: LiveReplicaProxy): Promise<Partial<object>>;

    export function replace(object: LiveReplicaProxy, value: object): LiveReplicaProxy;

    export function get(object: LiveReplicaProxy, path?): any;

    export function cloneDeep(object: LiveReplicaProxy, path?): object;

    export function set(object: LiveReplicaProxy, path: string, value: object);

    export function merge(object: LiveReplicaProxy, partial: object);

    export function createProxy(patchDiff: PatchDiff<any>, options?: object): LiveReplicaProxy;

    type ConnectionResults = {
        writable: boolean,
        rpc: boolean
    };

    export function connect(proxy:LiveReplicaProxy, connection: Socket<any>, remotePath:string, params:object): Promise<ConnectionResults>;
    export function disconnect(proxy:LiveReplicaProxy): Promise<any>;

    export type ObservedOptions = {
        onChange: string; // on change method name on the class
    }

    export function observed(options: ObservedOptions); // decorator
}