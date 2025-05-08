import LiveReplicaServer from "./server";

type Middleware = (...args: any[]) => void;

export class MiddlewareChain {
    chain: Middleware[];
    owner: LiveReplicaServer | MiddlewareChain;

    constructor(owner?: LiveReplicaServer) {
        this.chain = [];
        this.owner = owner || this;
    }

    start(...args: any[]) {
        const finishCallback = args.pop();
        if (typeof finishCallback !== 'function') {
            throw new TypeError(`MiddlewareChain.start()'s last argument must be a finish function, instead got ${typeof finishCallback}`);
        }
        this._run(0, finishCallback, args);
    }

    add(middleware: Middleware) {
        if (typeof middleware !== 'function') {
            throw new TypeError(`middleware must be a function, instead got ${typeof middleware}`);
        }

        this.chain.push(middleware);
    }

    use(middleware: Middleware) {
        this.add(middleware);
    }

    remove(middleware: Middleware) {
        const index = this.chain.indexOf(middleware);
        if (index !== -1) {
            this.chain.splice(index, 1);
        }
    }

    _run(index: number, finishCallback: (...args: any[]) => any, args: any[]) {
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

export default MiddlewareChain;