export interface LiveReplicaEventMap {
    subscribe: '$s';
    unsubscribe: '$u';
    invokeRPC: '$i';
    apply: '$a';
    dictionaryUpdate: '$d';
    '$s': 'subscribe';
    '$u': 'unsubscribe';
    '$i': 'invokeRPC';
    '$a': 'apply';
    '$d': 'dictionaryUpdate';
}

export const LiveReplicaEvents: LiveReplicaEventMap = {
    subscribe: '$s',
    unsubscribe: '$u',
    invokeRPC: '$i',
    apply: '$a',
    dictionaryUpdate: '$d'
} as LiveReplicaEventMap;

const names = Object.keys(LiveReplicaEvents) as (keyof LiveReplicaEventMap)[];
names.forEach((key) => {
    const value = LiveReplicaEvents[key];
    (LiveReplicaEvents as any)[value] = key;
});

export function eventName(event: string): string {
    const split = event.split(':');
    if (split.length === 2) {
        return [(LiveReplicaEvents as any)[split[0]] || event[0], split[1]].join(':');
    } else {
        return (LiveReplicaEvents as any)[event] || event;
    }
} 