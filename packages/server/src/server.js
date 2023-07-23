import { PatchDiff } from '../../patch-diff/index.js';
import { PatcherProxy } from '../../proxy/proxy.js';
import { MiddlewareChain } from './middleware-chain.js';
import { Utils } from '../../utils/utils.js';

const defaultTransformer = (data, dataPart) => data;
function serializeFunctions(data) {

    if (typeof data !== 'object') {
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
    }

    onConnect(connection) {

        const onsubscribe = (clientRequest, ack) => {
            const {id, path, allowRPC, allowWrite} = clientRequest;

            const subscribeRequest = {
                id,
                connection,
                ack,
                path,
                allowRPC,
                allowWrite
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
        const { path, connection, readTransformer = defaultTransformer, writeTransformer = defaultTransformer } = request;
        const clientSubset = this.at(path);
        let changeRevision = 0;

        const unsubscribeEvent = `unsubscribe:${request.id}`;
        const applyEvent = `apply:${request.id}`;
        const invokeRpcEvent = `invokeRPC:${request.id}`;
        let invokeRpcListener, replicaApplyListener;

        let subscriberChange = false;
        const unsubscribeChanges = clientSubset.subscribe((patchData, {snapshot}) => {
            if (!subscriberChange) {
                const updateInfo  =  snapshot ? {snapshot} : {snapshot : false};
                if (!snapshot) {
                    changeRevision++;
                    updateInfo.changeRevision = changeRevision;
                }

                patchData = readTransformer(patchData, clientSubset);
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

            replicaApplyListener = (payload) => {
                subscriberChange = payload.changeRevision === changeRevision;
                clientSubset.apply(writeTransformer(payload.data));
            };

            connection.on(applyEvent, replicaApplyListener);
        }

        if (request.allowRPC) {
            invokeRpcListener = ({path, args}, ack) => {
                const method = clientSubset.get(path);
                // check if promise
                const res = method.call(clientSubset, ...args);
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
            unsubscribeChanges();

            if (replicaApplyListener) { connection.removeListener(invokeRpcEvent, replicaApplyListener); }
            if (invokeRpcListener)    { connection.removeListener(invokeRpcEvent, invokeRpcListener); }

            connection.removeListener(unsubscribeEvent, onUnsubscribe);
            connection.removeListener('disconnect', onUnsubscribe);
            connection.removeListener('close', onUnsubscribe);

            this.emit('replica-unsubscribe', request);
        });

        connection.on(unsubscribeEvent, onUnsubscribe);
        connection.on('disconnect', onUnsubscribe);
        connection.on('close', onUnsubscribe);
    }

    use(fn) {
        this.middlewares.use(fn);
    }

    destroy() {
        this.emit('destroy');
        this.middlewares.clear();
        this.remove();
    }
}

export default LiveReplicaServer;