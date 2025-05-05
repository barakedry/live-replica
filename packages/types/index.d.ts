declare module '@live-replica/live-replica' {
    export type KeyList = string[] | Set<string>;

    export type DiffInfo<T = any> = {
        snapshot?: boolean;
        hasAdditions?: boolean;
        hasAddedObjects?: boolean;
        hasDeletions?: boolean;
        hasUpdates?: boolean;
        hasDifferences?: boolean;
        additions?: T extends Array<any> ? Array<T[number]> : Partial<T>;
        deletions?: Partial<T>;
        updates?: Partial<T>;
        addedObjects?: Partial<T>;
        differences?: T extends Array<any> ? Array<T[number]> : Partial<T>;
        changeType?: 'displace' | 'change' | '';
    }

    export type Proxy<T = any> = T & object;
    export type ProxyOptions = { readonly: boolean }

    export type SubscribeCallback<T = any> = (
        patchOrSnapshot?: Partial<T>,
        changeInfo?: DiffInfo<T>,
        context?: any,
        deferred?: boolean,
        params?: Record<string, any>
    ) => void;

    export type UnsubscribeCallback = () => void;

    export class Origin<T = any> extends PatchDiff<T> {
        get data(): Proxy<T>;
    }

    export type SubscriptionRequest = ReplicaPermissions & {
        path: string;
        readTransformer?: <T>(data: Partial<T>, part?: PatchDiff<T>) => any;
        writeTransformer?: <T>(data: Partial<T>, part?: PatchDiff<T>) => any;
        whitelist?: KeyList;
        target?: Origin;
        params?: object;
        [key: string]: any;
    }

    export type Middleware = (request: SubscriptionRequest, reject: (reason: string) => void, next: (request: SubscriptionRequest) => void) => void;

    export class Server<T = any> extends PatchDiff<T> {
        use(middleware: Middleware): void;
        at(subPath: string): Origin<T>;
        handleWebSocket(socket: any): () => void;
    }

    export class Socket<SocketType> {
        constructor(socket: SocketType);
        set socket(socket: SocketType);
        get baseSocket(): SocketType;
        connect(baseSocket: SocketType): void;
        disconnect(): void;
        isConnected(): boolean;
    }

    export type ReplicaPermissions = { allowWrite: boolean; allowRPC: boolean };
    export type ReplicaOptions = ReplicaPermissions & {
        dataObject: object;
        params?: object;
        subscribeRemoteOnCreate: boolean;
        connection: Socket<any>;
    }

    export class Replica<T = any> extends PatchDiff<T> {
        static create<U extends object>(initObject: U, options: ReplicaOptions): LiveReplicaProxy<U>;
        constructor(remotePath: string, options: Partial<ReplicaOptions>);
        remotePath: string;
        connect(connection: Socket<any>, remotePath: string, params?: object): Promise<any>;
        disconnect(): Promise<any>;
        at(subPath: string): Replica<T>;
        subscribed: Promise<any>;
        synced: Promise<any>;
        subscribeRemote(connection: Socket<any>, subscribeSuccessCallback: Function, subscribeRejectCallback: Function): void;
        unsubscribeRemote(): void;
        reset(): Promise<any>;
        destroy(): void;
        get data(): Proxy<T>;
    }

    export class WebSocketClient extends Socket<WebSocket> {}
    export class WebSocketServer extends Server {
        handleWebSocket(socket: any): () => void;
    }

    export type ObservedOptions = {
        onChange: string;
    }

    export function observed(options: ObservedOptions): PropertyDecorator;
}