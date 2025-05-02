"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveReplicaEvents = void 0;
exports.eventName = eventName;
exports.LiveReplicaEvents = {
    subscribe: '$s',
    unsubscribe: '$u',
    invokeRPC: '$i',
    apply: '$a',
    dictionaryUpdate: '$d'
};
const names = Object.keys(exports.LiveReplicaEvents);
names.forEach((key) => {
    const value = exports.LiveReplicaEvents[key];
    exports.LiveReplicaEvents[value] = key;
});
function eventName(event) {
    const split = event.split(':');
    if (split.length === 2) {
        return [exports.LiveReplicaEvents[split[0]] || event[0], split[1]].join(':');
    }
    else {
        return exports.LiveReplicaEvents[event] || event;
    }
}
//# sourceMappingURL=event-name.js.map