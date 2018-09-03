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
    const split = event.split(':');
    if (split.length === 2) {
        return [LiveReplicaEvents[split[0]] || event[0], split[1]].join(':');
    } else {
        return LiveReplicaEvents[event] || event;
    }

};