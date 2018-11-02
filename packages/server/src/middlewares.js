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

        return function onSubscribe(request, reject, approve) {
            const server = this;

            if (path && request.path !== path) {
                return approve();
            }

            if (!subscriptionCounter.has(this)) {
                subscriptionCounter.set(this, {});
            }

            const subscribePath = request.path;
            const subscribed = subscriptionCounter.get(this);
            if (!subscribed.hasOwnProperty(subscribePath)) {
                subscribed[subscribePath] = 0;
            }

            if (subscribed[subscribePath] === 0) {
                server.on('replica-unsubscribe', function onUnsubscribe(unsubscriberRequest)  {
                    if (subscribePath === unsubscriberRequest.path) {

                        if (!subscribed[subscribePath]) {
                            assert('')
                        }

                        subscribed[subscribePath]--;

                        if (subscribed[subscribePath] <= 0) {
                            delete subscribed[subscribePath];
                            server.removeListener('replica-unsubscribe', onUnsubscribe);
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