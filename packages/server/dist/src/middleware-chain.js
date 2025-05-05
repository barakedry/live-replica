"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiddlewareChain = void 0;
class MiddlewareChain {
    constructor(owner) {
        this.chain = [];
        this.owner = owner || this;
    }
    start(...args) {
        const finishCallback = args.pop();
        if (typeof finishCallback !== 'function') {
            throw new TypeError(`MiddlewareChain.start() last arguments must be a finish function, instead got ${typeof finishCallback}`);
        }
        this._run(0, finishCallback, args);
    }
    add(middleware) {
        if (typeof middleware !== 'function') {
            throw new TypeError(`middleware must be a function, instead got ${typeof middleware}`);
        }
        this.chain.push(middleware);
    }
    use(middleware) {
        this.add(middleware);
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
        middleware.call(this.owner, ...args.concat(function next() {
            self._run(index + 1, finishCallback, args);
        }));
    }
    clear() {
        this.chain = [];
    }
}
exports.MiddlewareChain = MiddlewareChain;
MiddlewareChain.prototype.use = MiddlewareChain.prototype.add;
exports.default = MiddlewareChain;
//# sourceMappingURL=middleware-chain.js.map