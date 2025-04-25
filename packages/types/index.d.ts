declare module '@live-replica/live-replica' {
        export type EventListener = (...args: any[]) => void;

        export class EventEmitter {
            setMaxListeners(num: number): void;
            on(eventName: string, cb: EventListener): void;
            addEventListener(eventName: string, cb: EventListener): void;
            addListener(eventName: string, cb: EventListener): void;
            off(eventName: string, cb: EventListener): void;
            removeEventListener(eventName: string, cb: EventListener): void;
            removeListener(eventName: string, cb: EventListener): void;
            once(eventName: string, cb: EventListener): void;
            emit(eventName: string, ...args: any[]): void;
            removeAllListeners(eventName: string): void;
            listenersOf(eventName: string): EventListener[];
            listenerCount(eventName: string): number;
        }

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

        export type SpliceParams = { index: number; itemsToRemove: number; itemsToAdd?: any[] }

        export type MutationOptions = {
            defer?: boolean;
            context?: any;
            [key: string]: any;
        }

        export type MergeOptions = MutationOptions & {
            overrides?: Record<string, true> | string[];
        }

        export type ApplyOptions = {
            emitEvents?: boolean;
            maxKeysInLevel?: 1000;
            maxLevels?: 50;
            maxListeners?: 1000000;
        }

        export class PatchDiff<T = any> extends EventEmitter {
            apply(patch: Partial<T>, path?: string, options?: MergeOptions): Partial<T>;
            patch(patch: Partial<T>, path?: string, options?: MergeOptions): Partial<T>;
            merge(patch: Partial<T>, path?: string, options?: MergeOptions): Partial<T>;
            set<K extends keyof T>(value: T[K], path?: K, options?: MutationOptions): Partial<T>;
            displace<K extends keyof T>(value: T[K], path?: K, options?: MutationOptions): void;
            override<K extends keyof T>(value: T[K], path?: K, options?: MutationOptions): Partial<T>;
            remove(path?: string, options?: MutationOptions): Partial<T>;
            splice(spliceParams: SpliceParams, path?: string, options?: MutationOptions): any;
            get<K extends keyof T>(path?: K): T[K];
            getAll(pathPattern: string): Array<{value: T[keyof T], params: object, isPattern?: boolean}>;
            getClone<K extends keyof T>(path?: K): T[K];
            subscribe(path: string, callback?: SubscribeCallback<T>, skipInitial?: boolean): UnsubscribeCallback;
            subscribe(callback: SubscribeCallback<T>, skipInitial?: boolean): UnsubscribeCallback;
            at(subPath: string): PatchDiff<T>;
            scope(subPath: string): PatchDiff<T>;
            whitelist(keys: KeyList): void;
            getWhenExists<K extends keyof T>(path?: K): Promise<T[K]>;
            whenAnything<K extends keyof T>(path?: K): Promise<T[K]>;
            getFullPath(subPath?: string): string;
            getData(proxyOptions?: Partial<ProxyOptions>): Proxy<T>;
            get data(): Proxy<T>;
            get root(): PatchDiff<T>;
        }

        export class Origin<T = any> extends PatchDiff<T> {
            get data(): Proxy<T>;
        }

        export type SubscriptionRequest = ReplicaPermissions & {
            path: string;
            readTransformer?: <T>(data: T, part?: PatchDiff<T>) => any;
            writeTransformer?: <T>(data: T, part?: PatchDiff<T>) => any;
            whitelist?: KeyList;
            target?: Origin;
            params?: object;
            [key: string]: any;
        }

        export type Middleware = (request: SubscriptionRequest, reject: (reason: string) => void, next: (request: SubscriptionRequest) => void) => void;

        export class Server<T = any> extends PatchDiff<T> {
            use(middleware: Middleware): void;
            at(subPath: string): Origin<T>;
            handleWebSocket(socket: any): void;
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
            handleWebSocket(socket: any): void;
        }

        export type LiveReplicaProxy<T = any> = T & object;

        // Function declarations with generics
        export function getProxy<T>(value: T): LiveReplicaProxy<T>;
        export function getPatchDiff<T>(proxy: LiveReplicaProxy<T>): PatchDiff<T>;
        export function observe<T>(object: LiveReplicaProxy<T>, cb: SubscribeCallback<T>): UnsubscribeCallback;
        export function subscribe<T>(object: LiveReplicaProxy<T>, cb: SubscribeCallback<T>): UnsubscribeCallback;
        export function unwrap<T>(object: LiveReplicaProxy<T>): T;
        export function nextChange<T>(object: LiveReplicaProxy<T>): Promise<Partial<T>>;
        export function replace<T>(object: LiveReplicaProxy<T>, value: T): LiveReplicaProxy<T>;
        export function get<T, K extends keyof T>(object: LiveReplicaProxy<T>, path?: K): T[K];
        export function set<T, K extends keyof T>(object: LiveReplicaProxy<T>, path: K, value: T[K]): void;
        export function merge<T>(object: LiveReplicaProxy<T>, partial: Partial<T>): void;
        export function createProxy<T>(patchDiff: PatchDiff<T>, options?: object): LiveReplicaProxy<T>;
        export function hasProxy(value: any): boolean;
        export function isProxy(value: any): boolean;
        export function cloneDeep<T>(object: LiveReplicaProxy<T>, path?: string): T;

        export type ConnectionResults = {
            writable: boolean;
            rpc: boolean;
        }

        export function connect<T>(proxy: LiveReplicaProxy<T>, connection: Socket<any>, remotePath: string, params?: object): Promise<ConnectionResults>;
        export function disconnect<T>(proxy: LiveReplicaProxy<T>): Promise<any>;

        export type ObservedOptions = {
            onChange: string;
        }

        export function observed(options: ObservedOptions): PropertyDecorator;
    }