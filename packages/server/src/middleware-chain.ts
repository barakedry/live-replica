export class MiddlewareChain {
    chain: any[];
    owner: any;
    constructor(owner?: any) {
        this.chain = [];
        this.owner = owner || this;
    }

    start(...args: any[]) {
        const finishCallback = args.pop();
        if (typeof finishCallback !== 'function') {
            throw new TypeError(`MiddlewareChain.start() last arguments must be a finish function, instead got ${typeof finishCallback}`);
        }
        this._run(0, finishCallback, args);
    }

    add(middleware: any) {
        if (typeof middleware !== 'function') {
            throw new TypeError(`middleware must be a function, instead got ${typeof middleware}`);
        }

        this.chain.push(middleware);
    }

    use(middleware: any) {
        this.add(middleware);
    }

    remove(middleware: any) {
        const index = this.chain.indexOf(middleware);
        if (index !== -1) {
            this.chain.splice(index, 1);
        }
    }

    _run(index: number, finishCallback: any, args: any[]) {
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

MiddlewareChain.prototype.use = MiddlewareChain.prototype.add;

export default MiddlewareChain;