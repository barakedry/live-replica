/**
 * Created by barakedry on 02/06/2018.
 */
'use strict';
import Middlewares from './middleware-chain.js';

class Server {

    constructor(source) {
        this.source = source;
        this.middlewares = new Middlewares();
    }

    onConnect(connection) {

    }

    onSubscribeRequest(subscribeRequest) {
        this.middlewares.run(subscribeRequest, (request) => {

        });
    }

    use(fn) {
        this.middlewares.use(fn);
    }
};

module.exports = Server;