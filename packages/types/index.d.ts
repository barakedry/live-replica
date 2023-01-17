export = LiveReplica;

declare namespace LiveReplica {

    type EventListener = (...args) => void;

    class EventEmitter {
        setMaxListeners(num:number);
        on(eventName:string, cb:EventListener);
        addEventListener(eventName:string, cb:EventListener);
        addListener(eventName:string, cb:EventListener);

        off(eventName:string, cb:EventListener);
        removeEventListener(eventName:string, cb:EventListener);
        removeListener(eventName:string, cb:EventListener);

        once(eventName:string, cb:EventListener);
        emit(eventName, ...args);
        removeAllListeners(eventName:string);
        listenersOf(eventName:string):EventListener[]
        listenerCount(eventName:string):number

    }


    type DiffInfo = {
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

    type SubscribeCallback = (differencesOrSnapshot?: object, changeInfo?:DiffInfo) => void;
    type UnsubscribeCallback = () => void;
    type SpliceParams = { index: number, itemsToRemove: number, itemsToAdd?:Array<any>}

    class PatchDiff extends EventEmitter {
        apply(patch:object, path?:string, options?:object);
        set(fullDocument:object, path?:string, options?:object);
        remove(path?:string, options?:object);
        splice(spliceParams:SpliceParams, path?:string, options?:object);
        get(path?:string, callback?:(data:object) => void);
        get(callback?:(data:object) => void);
        getClone(path?:string):object;
        subscribe(path:string, callback?:SubscribeCallback):UnsubscribeCallback;
        subscribe(callback:SubscribeCallback):UnsubscribeCallback;
        getWhenExists(path?:string) : Promise<object>;
        whenAnything(path?:string) : Promise<object>;
        at(subPath) : PatchDiff;

        get data() : Proxy;

        getData(proxyOptions?:Partial<ProxyOptions>):Proxy
    }



    type Proxy = object;
    type ProxyOptions = {immediateFlush: boolean}


    class Origin extends PatchDiff {
        get data() : Proxy;
    }

    type SubscriptionRequest = ReplicaPermissions & {
        path: string;
        transformer?: (data:any, part:PatchDiff) => any;
        [key:string]: any;
    }

    type Middleware = (request:SubscriptionRequest, reject: (reason:string) => void, next:(request:SubscriptionRequest) => void) => void;

    class Server extends PatchDiff {

        use(middleware:Middleware);
        at(subPath): Origin;
    }


    class Socket<SocketType> {
        constructor(socket:SocketType);
        set socket(socket:SocketType);
        get baseSocket():SocketType;
        disconnect();
        isConnected():boolean
        connect(baseSocket:SocketType);
        disconnect();
        isConnected():boolean;
    }

    type ReplicaPermissions = { allowWrite: boolean, allowRPC: boolean };
    type ReplicaOptions = ReplicaPermissions & {
        dataObject: object,
        subscribeRemoteOnCreate: boolean,
        connection: Socket<any>
    }

    class Replica extends PatchDiff {
        constructor(remotePath:string, options: Partial<ReplicaOptions>);
        public remotePath:string;

        at(subPat:string): Replica;
        subscribed:Promise<any>;
        subscribeRemote(connection:Socket<any>, subscribeSuccessCallback:Function, subscribeRejectCallback:Function)
        unsubscribeRemote();
        destroy();
    }

    class WebSocketClient extends Socket<WebSocket> {}

    class WebSocketServer extends Server {
        handleWebSocket(socket);
    }

    class PatcherProxy  {
        public static isProxy(proxy): boolean;
        public static unwrap(proxy): object;
        public static getPatchDiff(proxy): PatchDiff;
        public static create(patcher:PatchDiff, path:string, root?:PatchDiff, readonly?:boolean, immediateFlush?:boolean);
    }

    type ApplyOptions = {
        emitEvents?: boolean
        maxKeysInLevel?: 1000,
        maxLevels?: 50,
        maxListeners?: 1000000
    };

    type LiveReplicaProxy = object;
    function observe(object:LiveReplicaProxy, cb:SubscribeCallback) : UnsubscribeCallback;
    function subscribe(object:LiveReplicaProxy, cb:SubscribeCallback) : UnsubscribeCallback;
    function unwrap(object:LiveReplicaProxy) : object;
    function nextChange(object:LiveReplicaProxy) : Promise<Partial<object>>;
    function replace(object:LiveReplicaProxy, value:object) : LiveReplicaProxy;
    function get(object:LiveReplicaProxy, path?) : any;
    function cloneDeep(object:LiveReplicaProxy, path?) : object;
    function set(object:LiveReplicaProxy, path:string, value:object);
    function merge(object:LiveReplicaProxy, partial:object);
}



