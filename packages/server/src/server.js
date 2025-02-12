import { PatchDiff } from '../../patch-diff/index.js';
import { MiddlewareChain } from './middleware-chain.js';
import { Utils } from '../../utils/utils.js';

const defaultTransformer = (data, dataPart) => data;
function serializeFunctions(data) {

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

    constructor(options) {
        options = Object.assign({}, options);
        super(options.dataObject || {}, options);

        this.proxies = new WeakMap();

        this.middlewares = new MiddlewareChain(this);
        this.unsubMiddlewares = new MiddlewareChain(this);
    }

    onConnect(connection) {

        const onsubscribe = (clientRequest, ack) => {
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

    onSubscribeRequest(subscribeRequest) {
        this.emit('subscribe-request', subscribeRequest);

        subscribeRequest = Object.assign({
            allowWrite: false,
            allowRPC: false
        }, subscribeRequest);

        let reject = function(rejectReason) {
            subscribeRequest.ack({rejectReason});
        };

        this.middlewares.start(subscribeRequest, reject, (request) => {
            this.emit('subscribe', request);

            subscribeRequest.ack({success: true, writable: request.allowWrite, rpc: request.allowRPC});

            this.subscribeClient(request);
        });
    }

    subscribeClient(request) {
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
        let invokeRpcListener, replicaApplyListener;

        let subscriberChange = false;
        let transformedClientPatch = false;
        const unsubscribeChanges = target.subscribe((patchData, {snapshot, changeType, deletePatch}) => {
            if (transformedClientPatch || !subscriberChange) {
                const updateInfo  =  snapshot ? {snapshot} : {snapshot : false, displace: changeType === 'displace'};
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

            replicaApplyListener = (payload, metadata) => {
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
            invokeRpcListener = ({path, args}, ack) => {
                const method = target.get(path);
                // check if promise
                const res = method.call(target, ...args);
                if (res && typeof res.then === 'function') {
                    res.then(ack).catch((err) => {
                        ack({$error: {message: err.message, name: err.name}});
                    });
                } else {
                    ack(res);
                }
            };

            connection.on(invokeRpcEvent, invokeRpcListener);
        }

        const onUnsubscribe = Utils.once(() => {
            this.emit('replica-unsubscribing', request);
            this.unsubMiddlewares.start(request, (request) => {
                unsubscribeChanges();

                if (replicaApplyListener) { connection.removeListener(applyEvent, replicaApplyListener); }
                if (invokeRpcListener)    { connection.removeListener(invokeRpcEvent, invokeRpcListener); }

                connection.removeListener(unsubscribeEvent, onUnsubscribe);
                connection.removeListener('disconnect', onUnsubscribe);
                connection.removeListener('close', onUnsubscribe);

                // old event for backward compatibility
                this.emit('replica-unsubscribe', request);

                this.emit('replica-unsubscribed', request);
            });
        });

        connection.on(unsubscribeEvent, onUnsubscribe);
        connection.on('disconnect', onUnsubscribe);
        connection.on('close', onUnsubscribe);
    }

    use(fn) {
        this.middlewares.use(fn);
    }

    addUnsubscriptionMiddleware(fn) {
        this.unsubMiddlewares.use(fn);
    }

    destroy() {
        this.emit('destroy');
        this.middlewares.clear();
        this.remove();
    }
}

export default LiveReplicaServer;