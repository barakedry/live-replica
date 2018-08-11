/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';

const LiveReplicaEvents = {
    subscribe: '$s',
    unsubscribe: '$u',
    invokeRPC: '$i',
    apply: '$a',
    dictionaryUpdate: '$d'
};

const names = Object.keys(LiveReplicaEvents);
names.forEach((key) => {
    const value = LiveReplicaEvents[key];
    LiveReplicaEvents[value] = key;
});

module.exports = function eventName(event) {
    return LiveReplicaEvents[event] || event;
};