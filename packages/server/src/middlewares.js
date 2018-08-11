/**
 * Created by barakedry on 12/08/2018.
 */
'use strict';

module.exporst = {
    oncePerSubscription(path, firstSubscriptionCallback, lastSubscriptionCallback) {

        if (typeof path === 'function') {
            lastSubscriptionCallback = firstSubscriptionCallback;
            firstSubscriptionCallback = path;
            path = undefined;
        }

        let subscribed = 0;
        return function onSubscribe(request, reject, approve) {
            const server = this;

            if (path && unsubscriberRequest.path !== path) {
                return approve();
            }


            if (subscribed === 0) {

                server.on('unsubscribe', function onUnsubscribe(unsubscriberRequest)  {
                    if (!path || unsubscriberRequest.path === path) {
                        subscribed--;

                        if (subscribed <= 0) {
                            subscribed = 0;
                            server.removeEventListener('unsubscribe', onUnsubscribe);
                            if (lastSubscriptionCallback) {
                                lastSubscriptionCallback.call(server, unsubscriberRequest);
                            }

                        }
                    }
                });

                firstSubscriptionCallback.call(server, unsubscriberRequest);
            }

            subscribed++;
            approve();
        };
    }
};