/**
 * Created by barakedry on 12/08/2018.
 */
'use strict';

function whitelist(list) {
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
function oncePerSubscription(path, firstSubscriptionCallback, lastSubscriptionCallback, matchPathes = (path1, path2) => path1 === path2) {

    if (typeof path === 'function') {
        lastSubscriptionCallback = firstSubscriptionCallback;
        firstSubscriptionCallback = path;
        path = undefined;
    }

    return function onSubscribe(request, reject, approve) {
        const server = this;

        if (path && !matchPathes(request.path, path)) {
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
                    if (matchPathes(subscribePath, unsubscriberRequest.path)) {

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

module.exports = {
    oncePerSubscription,
    whitelist
};
