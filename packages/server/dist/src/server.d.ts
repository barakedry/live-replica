import { PatchDiff } from '../../patch-diff';
import { MiddlewareChain } from './middleware-chain';
export declare class LiveReplicaServer extends PatchDiff {
    proxies: WeakMap<any, any>;
    middlewares: MiddlewareChain;
    unsubMiddlewares: MiddlewareChain;
    constructor(options: any);
    onConnect(connection: any): () => any;
    onSubscribeRequest(subscribeRequest: any): void;
    subscribeClient(request: any): void;
    use(fn: any): void;
    addUnsubscriptionMiddleware(fn: any): void;
    destroy(): void;
}
export default LiveReplicaServer;
//# sourceMappingURL=server.d.ts.map