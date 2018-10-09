/**
 * Created by barakedry on 02/06/2018.
 */
'use strict';
const PatchDiff = require('@live-replica/patch-diff');
const PatcherProxy = require('@live-replica/proxy');
const Middlewares = require('./middleware-chain.js');

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

        let ownerChange = false;
        clientSubset.subscribe((patchData) => {
            if (!ownerChange) {
                connection.send(applyEvent, patchData);
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
            connection.on(applyEvent, (payload) => {
                ownerChange = true;
                clientSubset.apply(payload);
            });
        }

        if (request.allowRPC) {

            connection.on(invokeRpcEvent, ({path, args}, ack) => {
                const method = clientSubset.get(path);
                // check if promise
                const res = method.call(clientSubset, ...args);
                if (res && typeof res.then === 'function') {
                    res.then(ack);
                } else {
                    ack(res);
                }
            });

        }

        const onUnsubscribe = () => {
            request.connection.removeListener(unsubscribeEvent, onUnsubscribe);
            request.connection.removeListener('disconnect', onUnsubscribe);
            this.emit('unsubscribe', request);
        };


        request.connection.once(unsubscribeEvent, onUnsubscribe);
        request.connection.once('disconnect', onUnsubscribe);
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