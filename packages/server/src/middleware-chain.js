/**
 * Created by barakedry on 02/06/2018.
 */
'use strict';

class MiddlewareChain {
    constructor() {
        this.chain = [];
    }

    start(...args) {
        const finishCallback = args.pop();
        if (typeof finishCallback !== 'function') {
            throw new Error('MiddlewareChain.start() last arguments must be a finish function');
        }
        this._run(0, finishCallback, args);
    }

    add(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('middleware must be a function');
        }

        this.chain.push(middleware);
    }

    remove(middleware) {
        const index = this.chain.indexOf(middleware);
        if (index !== -1) {
            this.chain.splice(index, 1);
        }
    }

    _run(index, finishCallback, args) {
        const self = this;
        if (index >= this.chain.length) {
            return finishCallback(...args);
        }

        const middleware = this.chain[index];
        middleware(...args.concat(function next() {
            self._run(index + 1, finishCallback, args);
        }));
    }
}

MiddlewareChain.prototype.use = MiddlewareChain.prototype.add;

// export default MiddlewareChain;
module.exports = MiddlewareChain;