/**
 * Created by barakedry on 02/06/2018.
 */
'use strict';

// import PatchDiff = require('@live-replica/patch-diff';
// import PatcherProxy = require('@live-replica/proxy';
// import Middlewares = require('./middleware-chain.js';


const PatchDiff = require('@live-replica/patch-diff');
const PatcherProxy = require('@live-replica/proxy');
const Middlewares = require('./middleware-chain.js');

class LiveReplicaServer extends PatchDiff {

    constructor(options) {
        super();

        this.options = Object.assign({
        }, options);


        this.middlewares = new Middlewares();
    }

    onConnect(socket) {
        connection.on('subscribe', (clientRequest, ack) => {
            const {path, allowRPC, allowWrite} = clientRequest;

            const subscribeRequest = {
                socket,
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

        this.middlewares.run(subscribeRequest, reject, (request) => {
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
                request.socket.send(data.differences);
            }

            ownerChange = false;
        });

        if (request.allowWrite) {
            request.socket.on('apply', (payload) => {
                ownerChange = true;
                clientSubset.apply(payload);
            });
        }

        if (request.allowRPC) {
        }
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

module.exports = LiveReplicaServer;