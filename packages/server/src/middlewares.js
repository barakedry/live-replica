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

const serverCounters = new WeakMap();
const underwaySubscriptionsPerTarget = new WeakMap();
export function oncePerSubscriptionOld(path, firstSubscriptionCallback, lastSubscriptionCallback, matchPaths = (path1, path2) => path1 === path2) {

    if (typeof path === 'function') {
        lastSubscriptionCallback = firstSubscriptionCallback;
        firstSubscriptionCallback = path;
        path = undefined;
    }

    return function onSubscribe(request, reject, approve) {
        const server = this;

        if (path && !matchPaths(request.path, path)) {
            return approve(request);
        }

        if (!serverCounters.has(server)) {
            serverCounters.set(server, {});
        }

        const subscribePath = request.path;
        const subscribersPerPath = serverCounters.get(server);
        if (!subscribersPerPath.hasOwnProperty(subscribePath)) {
            subscribersPerPath[subscribePath] = 0;
        }

        if (subscribersPerPath[subscribePath] === 0) {
            (async () => {

                let awaitingDone;
                let awaitingFirstSubscriptionHandlingToEnd = true;

                server.on('replica-unsubscribe', function onUnsubscribe(unsubscriberRequest)  {
                    if (matchPaths(subscribePath, unsubscriberRequest.path)) {

                        if (!subscribersPerPath[subscribePath]) {
                            assert('')
                        }

                        subscribersPerPath[subscribePath]--;

                        if (subscribersPerPath[subscribePath] <= 0) {
                            delete subscribersPerPath[subscribePath];
                            server.removeListener('replica-unsubscribe', onUnsubscribe);
                            if (lastSubscriptionCallback) {
                                if (awaitingFirstSubscriptionHandlingToEnd) {
                                    awaitingDone = () => { lastSubscriptionCallback.call(server, unsubscriberRequest); };
                                } else {
                                    lastSubscriptionCallback.call(server, unsubscriberRequest);
                                }

                            }

                        }
                    }
                });

                const success = await firstSubscriptionCallback.call(server, request, reject, approve);
                awaitingFirstSubscriptionHandlingToEnd = false;

                if (awaitingDone) {
                    awaitingDone();
                    awaitingDone = undefined;
                }

                if (success === false && subscribersPerPath[subscribePath]) {
                    subscribersPerPath[subscribePath]--;
                }

            })();

        } else {
            approve(request);
        }

        subscribersPerPath[subscribePath]++;
    };
}


export function oncePerSubscription(path, firstSubscriptionCallback, lastSubscriptionCallback, matchPaths = (path1, path2) => path1 === path2) {

    if (typeof path === 'function') {
        lastSubscriptionCallback = firstSubscriptionCallback;
        firstSubscriptionCallback = path;
        path = undefined;
    }

    return async function onSubscribe(request, reject, approve) {
        const server = this;

        if (path && !matchPaths(request.path, path)) {
            return approve(request);
        }

        if (!serverCounters.has(server)) {
            serverCounters.set(server, {});
        }

        if (!underwaySubscribersPerTarget.has(server)) {
            underwaySubscriptionsPerTarget.set(server, {});
        }

        const subscribersPerPath = serverCounters.get(server);
        const underwaySubscriptions = underwaySubscribersPerTarget.get(server);
        const subscribePath = request.path;

        if (!subscribersPerPath.hasOwnProperty(subscribePath)) {
            subscribersPerPath[subscribePath] = 0;
        }

        subscribersPerPath[subscribePath]++;

        // for first subscription
        if (subscribersPerPath[subscribePath] === 1) {
            const onUnsubscribe = async (unsubscriberRequest) => {
                if (matchPaths(subscribePath, unsubscriberRequest.path)) {

                    if (!subscribersPerPath[subscribePath]) {
                        assert('')
                    }

                    subscribersPerPath[subscribePath]--;

                    if (subscribersPerPath[subscribePath] <= 0) {
                        delete subscribersPerPath[subscribePath];
                        server.removeListener('replica-unsubscribe', onUnsubscribe);
                        if (lastSubscriptionCallback) {
                            await underwaySubscriptions[rsubscribePath];
                            lastSubscriptionCallback.call(server, unsubscriberRequest);
                        }
                    }
                }
            };

            // attach unsubscribe handler
            server.on('replica-unsubscribe', onUnsubscribe);

            const underway = firstSubscriptionCallback.call(server, request, reject, approve)

            underway.then((success) => {
                if (success === false && subscribersPerPath[subscribePath]) {
                    if (subscribersPerPath[subscribePath] <= 0) {
                        delete subscribersPerPath[subscribePath];
                        server.removeListener('replica-unsubscribe', onUnsubscribe);
                    }
                }
            }).finally(() => {
                delete underwaySubscriptions[subscribePath];
            });

            underwaySubscriptions[subscribePath] = underway;

        } else {
            approve(request);
        }

    };
}