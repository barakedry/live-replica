export function whitelist(list: any[] | Set<any>) {
    if (Array.isArray(list)) {
        list = new Set(list);
    } else if (!(list instanceof Set)) {
        throw new TypeError('"list" must be an Array or a Set');
    }

    return function whitelistTest(request: any, reject: any, approve: any) {
        if (list.has(request.path)) {
            approve(request);
        } else {
            reject(`Unauthorized subscription to "${request.path}"`);
        }
    }
}

export function oncePerSubscription(path: string | (() => string) | undefined, firstSubscriptionCallback: any, lastUnsubscriptionCallback?: any) {

    if (typeof path === 'function') {
        lastUnsubscriptionCallback = firstSubscriptionCallback;
        firstSubscriptionCallback = path;
        path = undefined;
    }

    const subscribersOfPath: Record<string, Set<any>> = {};
    let server: any;

    const cleanup = (id: string, path: string) => {
        const subscribers = subscribersOfPath[path];
        subscribers.delete(id);

        if (subscribers.size === 0) {
            delete subscribersOfPath[path];
        }
    }

    const onUnsubscribe = (unsubscriberRequest: any, next: any) => {

        const {id, path} = unsubscriberRequest;
        const subscribers = subscribersOfPath[path];
        cleanup(id, path);

        if (subscribers.size === 0 && lastUnsubscriptionCallback) {
            lastUnsubscriptionCallback.call(server, unsubscriberRequest, next);
        } else {
            next(unsubscriberRequest);
        }
    }

    return async function onSubscribe(this: any, request: any, reject: any, approve: any) {
        if (!server) {
            server = this;
            server.addUnsubscriptionMiddleware(onUnsubscribe);
        }

        const {id, path} = request;

        if (!subscribersOfPath[path]) {
            subscribersOfPath[path] = new Set();
        }

        const subscribers = subscribersOfPath[path];
        subscribers.add(id);
        // first
        if (subscribers.size === 1) {
            subscribers.add(id);
            firstSubscriptionCallback.call(server, request, reject, approve);
            return;
        }

        approve(request);
    };
}