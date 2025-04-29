export const LiveReplicaEvents = {
    subscribe: '$s',
    unsubscribe: '$u',
    invokeRPC: '$i',
    apply: '$a',
    dictionaryUpdate: '$d'
};

// Create reverse mapping in a separate object
const ReverseEvents = {};
Object.entries(LiveReplicaEvents).forEach(([key, value]) => {
    ReverseEvents[value] = key;
});

export function eventName(event) {
    const split = event.split(':');
    if (split.length === 2) {
        // For colon-separated events, keep the original first part if it's already a shorthand
        const firstPart = split[0];
        if (ReverseEvents[firstPart]) {
            // If it's already a shorthand, keep it as is
            return event;
        }
        // Otherwise convert full name to shorthand if possible
        const mappedFirstPart = LiveReplicaEvents[firstPart] || firstPart;
        return `${mappedFirstPart}:${split[1]}`;
    } else {
        // For single events, if it's a shorthand keep it, otherwise try to convert to shorthand
        if (ReverseEvents[event]) {
            return event; // Keep existing shorthands as is
        }
        return LiveReplicaEvents[event] || event;
    }
}