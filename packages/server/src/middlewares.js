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
    const subsciptionPromiseById = new Map();
    let server;

    const cleanup = (id, path) => {
        const subscribers = subscribersOfPath[path];
        subscribers.delete(id);
        subsciptionPromiseById.delete(id);

        if (subscribers.size === 0) {
            delete subscribersOfPath[path];
        }
    }

    const onUnsubscribe = async (unsubscriberRequest, next) => {

        const {id, path} = unsubscriberRequest;

        if (path.includes('mappings') && path.includes('rpc')) {
            console.warn('!!! Unsubscribing from', path);
        }

        if (!server) {
            assert('unsubscribe before first subscribe, server not set');
        }

        // await subsciption to finish before attempting unsubscribe
        await subsciptionPromiseById.get(id);
        const subscribers = subscribersOfPath[path];
        cleanup(id, path);

        if (subscribers.size === 0) {
            if (lastUnsubscriptionCallback) {
                const result = lastUnsubscriptionCallback.call(server, unsubscriberRequest);
                if (result instanceof Promise) {
                    const promise = result;
                    try {
                        await promise;
                    } catch (error) {
                        cleanup(id, path);
                    }
                }

                next(unsubscriberRequest);
            }
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

        // first
        if (subscribers.size === 0) {
            subscribers.add(id);
            let result = firstSubscriptionCallback.call(server, request, reject, approve);
            if (result instanceof Promise) {
                const promise = result;
                subsciptionPromiseById.set(id, promise);
                try {
                    result = await promise;
                } catch (error) {
                    cleanup(id, path);
                    reject(error);
                } finally {
                    subsciptionPromiseById.delete(id);
                }

            }


            if (result === false) {
                cleanup(id, path);
                reject('Subscription not approved');
            }

            return;
        }

        await Promise.all(Array.from(subscribersOfPath[path]).map(id => subsciptionPromiseById.get(id)));
        subscribers.add(id);
        approve(request);
    };
}