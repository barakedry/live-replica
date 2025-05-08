
import { MiddlewareChain } from './middleware-chain';
import { Utils } from '../../utils/utils';
import PatchDiff from '../../patch-diff/src/patch-diff';

const defaultTransformer = (data: any) => data;
function serializeFunctions(data: any): any {
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    const ret = new (Object.getPrototypeOf(data).constructor)();
    const keys = Object.keys(data);
    for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        const value = data[key];
        if (typeof value === 'function') {
            ret[key] = Utils.SERIALIZED_FUNCTION;
        } else if (typeof value === 'object' && value !== null) {
            ret[key] = serializeFunctions(value);
        } else {
            ret[key] = value;
        }
    }
    return ret;
}

export class LiveReplicaServer extends PatchDiff {
    proxies: WeakMap<any, any>;
    middlewares: MiddlewareChain;
    unsubMiddlewares: MiddlewareChain;
    constructor(options: any) {
        options = Object.assign({}, options);
        super(options.dataObject || {}, options);
        this.proxies = new WeakMap();
        this.middlewares = new MiddlewareChain(this);
        this.unsubMiddlewares = new MiddlewareChain(this);
    }

    onConnect(connection: any) {
        const onsubscribe = (clientRequest: any, ack: any) => {
            const {id, path, allowRPC, allowWrite, params} = clientRequest;
            const subscribeRequest = {
                id,
                connection,
                ack,
                path,
                allowRPC,
                allowWrite,
                params
            };
            this.onSubscribeRequest(subscribeRequest);
        };
        connection.on('subscribe', onsubscribe);
        return () => connection.removeListener('subscribe', onsubscribe);
    }

    onSubscribeRequest(subscribeRequest: any) {
        this.emit('subscribe-request', subscribeRequest);
        subscribeRequest = Object.assign({
            allowWrite: false,
            allowRPC: false
        }, subscribeRequest);
        let reject = function(rejectReason: any) {
            subscribeRequest.ack({rejectReason});
        };
        this.middlewares.start(subscribeRequest, reject, (request: any) => {
            this.emit('subscribe', request);
            subscribeRequest.ack({success: true, writable: request.allowWrite, rpc: request.allowRPC});
            this.subscribeClient(request);
        });
    }

    subscribeClient(request: any) {
        const { path, connection, whitelist, readTransformer = defaultTransformer, writeTransformer = defaultTransformer } = request;
        let changeRevision = 0;
        let target;
        if (request.target) {
            target = request.target;
        } else {
            target = this.at(path);
            if (whitelist) {
                target.whitelist(Array.isArray(whitelist) ? new Set(whitelist) : whitelist);
            }
        }
        const unsubscribeEvent = `unsubscribe:${request.id}`;
        const applyEvent = `apply:${request.id}`;
        const invokeRpcEvent = `invokeRPC:${request.id}`;
        let invokeRpcListener: any, replicaApplyListener: any;
        let subscriberChange = false;
        let transformedClientPatch = false;
        const unsubscribeChanges = target.subscribe((patchData: any, {snapshot, changeType, deletePatch}: any) => {
            if (transformedClientPatch || !subscriberChange) {
                const updateInfo: any = snapshot ? {snapshot} : {snapshot : false, displace: changeType === 'displace'};
                if (!snapshot && subscriberChange) {
                    changeRevision++;
                    updateInfo.changeRevision = changeRevision;
                }
                if (deletePatch) {
                    updateInfo.deletePatch = deletePatch;
                }
                patchData = readTransformer(patchData, target);
                connection.send(applyEvent, serializeFunctions(patchData), updateInfo);
            }
            subscriberChange = false;
        });
        if (connection.listenerCount(applyEvent)) {
            connection.removeAllListeners(applyEvent);
        }
        if (connection.listenerCount(invokeRpcEvent)) {
            connection.removeAllListeners(invokeRpcEvent);
        }
        if (request.allowWrite) {
            replicaApplyListener = (payload: any, metadata: any) => {
                transformedClientPatch = writeTransformer !== defaultTransformer;
                subscriberChange = payload.changeRevision === changeRevision;
                if (metadata?.displace) {
                    target.set(writeTransformer(payload.data));
                } else {
                    target.apply(writeTransformer(payload.data));
                }
            };
            connection.on(applyEvent, replicaApplyListener);
        }
        if (request.allowRPC) {
            invokeRpcListener = ({path, args}: any, ack: any) => {
                const method = target.get(path);
                if (typeof method !== 'function') {
                    console.warn(`RPC method not found at path: ${path}`);
                    ack({ $error: { message: `RPC not function found`, name: 'MethodNotFound' } });
                    return;
                }

                try {
                    // check if promise
                    const res = method.call(target, ...args);
                    if (res && typeof res.then === 'function') {
                        res.then(ack).catch((err: { message: string, name: string }) => {
                            ack({ $error: { message: err.message, name: err.name } });
                        });
                    } else {
                        ack(res);
                    }
                } catch (err) {
                    console.error(err);
                    ack({ $error: { message: 'Error while executing RPC', name: 'MethodExecutionError' } });
                }
            };
            connection.on(invokeRpcEvent, invokeRpcListener);
        }
        const onUnsubscribe = Utils.once(() => {
            this.emit('replica-unsubscribing', request);
            this.unsubMiddlewares.start(request, (request: any) => {
                unsubscribeChanges();
                if (replicaApplyListener) { connection.removeListener(applyEvent, replicaApplyListener); }
                if (invokeRpcListener)    { connection.removeListener(invokeRpcEvent, invokeRpcListener); }
                connection.removeListener(unsubscribeEvent, onUnsubscribe);
                connection.removeListener('disconnect', onUnsubscribe);
                connection.removeListener('close', onUnsubscribe);
                this.emit('replica-unsubscribe', request);
                this.emit('replica-unsubscribed', request);
            });
        });
        connection.on(unsubscribeEvent, onUnsubscribe);
        connection.on('disconnect', onUnsubscribe);
        connection.on('close', onUnsubscribe);
    }

    use(fn: any) {
        this.middlewares.use(fn);
    }

    addUnsubscriptionMiddleware(fn: any) {
        this.unsubMiddlewares.use(fn);
    }

    destroy() {
        this.emit('destroy');
        this.middlewares.clear();
        this.remove(undefined, undefined);
    }
}

export default LiveReplicaServer;