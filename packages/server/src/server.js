/**
 * Created by barakedry on 02/06/2018.
 */
'use strict';
const PatchDiff = require('../../patch-diff');
const PatcherProxy = require('../../proxy');
const Middlewares = require('./middleware-chain.js');
const utils = PatchDiff.utils;

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
            ret[key] = utils.SERIALIZED_FUNCTION;
        } else if (typeof value === 'object' && value !== null) {
            ret[key] = serializeFunctions(value);
        } else {
            ret[key] = value;
        }
    }
    return ret;

}

class LiveReplicaServer extends PatchDiff {

    constructor(options) {
        options = Object.assign({}, options);
        super(options.dataObject || {}, options);

        this.middlewares = new Middlewares(this);
    }

    onConnect(connection) {
        connection.on('subscribe', (clientRequest, ack) => {
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
        });
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

            subscribeRequest.ack({success: true});

            this.subscribeClient(request);
        });
    }

    subscribeClient(request) {
        const path = request.path;
        const clientSubset = this.at(path);
        const connection = request.connection;

        const unsubscribeEvent = `unsubscribe:${request.id}`;
        const applyEvent = `apply:${request.id}`;
        const invokeRpcEvent = `invokeRPC:${request.id}`;
        let invokeRpcListener, replicaApplyListener;

        let ownerChange = false;
        const unsubscribeChanges = clientSubset.subscribe((patchData) => {
            if (!ownerChange) {
                connection.send(applyEvent, serializeFunctions(patchData));
            }

            ownerChange = false;
        });

        if (connection.listenerCount(applyEvent)) {
            connection.removeAllListeners(applyEvent);
        }

        if (connection.listenerCount(invokeRpcEvent)) {
            connection.removeAllListeners(invokeRpcEvent);
        }

        if (request.allowWrite) {

            replicaApplyListener = (payload) => {
                ownerChange = true;
                clientSubset.apply(payload);
            };

            connection.on(applyEvent, replicaApplyListener);
        }

        if (request.allowRPC) {
            invokeRpcListener = ({path, args}, ack) => {
                const method = clientSubset.get(path);
                // check if promise
                const res = method.call(clientSubset, ...args);
                if (res && typeof res.then === 'function') {
                    res.then(ack);
                } else {
                    ack(res);
                }
            };

            connection.on(invokeRpcEvent, invokeRpcListener);
        }

        const onUnsubscribe = () => {
            unsubscribeChanges();

            if (replicaApplyListener) { connection.removeListener(invokeRpcEvent, replicaApplyListener); }
            if (invokeRpcListener)    { connection.removeListener(invokeRpcEvent, invokeRpcListener); }

            connection.removeListener(unsubscribeEvent, onUnsubscribe);
            connection.removeListener('disconnect', onUnsubscribe);

            this.emit('replica-unsubscribe', request);
        };

        connection.on(unsubscribeEvent, onUnsubscribe);
        connection.on('disconnect', onUnsubscribe);
    }

    use(fn) {
        this.middlewares.use(fn);
    }

    get data() {
        if (this.options.readonly) {
            return this._data;
        } else {
            if (!this.proxies.has(this)) {
                const proxy = new PatcherProxy(this);
                this.proxies.set(this, proxy);
            }
            return this.proxies.get(this);
        }
    }
}

LiveReplicaServer.middlewares = require('./middlewares');

module.exports = LiveReplicaServer;