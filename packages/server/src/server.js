/**
 * Created by barakedry on 02/06/2018.
 */
'use strict';
const PatchDiff = require('@live-replica/patch-diff');
const PatcherProxy = require('@live-replica/proxy');
const Middlewares = require('./middleware-chain.js');

class LiveReplicaServer extends PatchDiff {

    constructor(options) {
        super();

        this.options = Object.assign({
        }, options);


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

        let ownerChange = false;
        clientSubset.subscribe((data) => {
            if (!ownerChange) {
                request.connection.send(data.differences);
            }

            ownerChange = false;
        });

        if (request.allowWrite) {
            request.connection.on('apply', (payload) => {
                ownerChange = true;
                clientSubset.apply(payload);
            });
        }

        if (request.allowRPC) {
        }

        const onUnsubscribe = () => {
            request.connection.removeListener('unsubscribe', onUnsubscribe);
            request.connection.removeListener('disconnect', onUnsubscribe);
            this.emit('unsubscribe', request);
        };


        request.connection.once('unsubscribe', onUnsubscribe);
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