/**
 * Created by barakedry on 12/08/2018.
 */
'use strict';

const subscriptionCounter = new WeakMap();

module.exports = {
    oncePerSubscription(path, firstSubscriptionCallback, lastSubscriptionCallback) {

        if (typeof path === 'function') {
            lastSubscriptionCallback = firstSubscriptionCallback;
            firstSubscriptionCallback = path;
            path = undefined;
        }

        let subscribed = 0;
        return function onSubscribe(request, reject, approve) {
            const server = this;

            if (path && request.path !== path) {
                return approve();
            }

            if (!subscriptionCounter.get(this)) {
                subscriptionCounter.set(this, {});
            }

            const subscribed = subscriptionCounter.get(this);
            if (!subscribed[request.path]) {
                subscribed[request.path] = 0;
            }

            if (subscribed[request.path] === 0) {

                server.on('unsubscribe', function onUnsubscribe(unsubscriberRequest)  {
                    if (!path || unsubscriberRequest.path === path) {
                        subscribed[request.path]--;

                        if (subscribed[request.path] <= 0) {
                            delete subscribed[request.path];
                            server.removeEventListener('unsubscribe', onUnsubscribe);
                            if (lastSubscriptionCallback) {
                                lastSubscriptionCallback.call(server, unsubscriberRequest);
                            }

                        }
                    }
                });

                firstSubscriptionCallback.call(server, request, reject, approve);
            }

            subscribed[request.path]++;
            approve();
        };
    }
};