export function whitelist(list) {
    if (Array.isArray(list)) {
        list = new Set(list);
    } else if (!(list instanceof Set)) {
        throw new TypeError('"list" must be an Array or a Set');
    }

    return function whitelistTest(request, reject, approve) {
        if (list.has(request.path)) {
            approve(request);
        } else {
            reject(`Unauthorized subscription to "${request.path}"`);
        }
    }
}

export function oncePerSubscription(path, firstSubscriptionCallback, lastUnsubscriptionCallback) {

    if (typeof path === 'function') {
        lastUnsubscriptionCallback = firstSubscriptionCallback;
        firstSubscriptionCallback = path;
        path = undefined;
    }

    const subscribersOfPath = {};
    let server;

    const cleanup = (id, path) => {
        const subscribers = subscribersOfPath[path];
        subscribers.delete(id);

        if (subscribers.size === 0) {
            delete subscribersOfPath[path];
        }
    }

    const onUnsubscribe = (unsubscriberRequest, next) => {

        const {id, path} = unsubscriberRequest;
        const subscribers = subscribersOfPath[path];
        cleanup(id, path);

        if (subscribers.size === 0 && lastUnsubscriptionCallback) {
            lastUnsubscriptionCallback.call(server, unsubscriberRequest, next);
        } else {
            next(unsubscriberRequest);
        }
    }

    return async function onSubscribe(request, reject, approve) {
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