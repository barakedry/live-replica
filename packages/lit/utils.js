import { PatcherProxy, Replica } from '@live-replica/client';

export function replicaByData(data) {
    if (PatcherProxy.proxyProperties.has(data)) {
        const root = PatcherProxy.getRoot(data);
        const basePath = PatcherProxy.getPath(data);
        const replica = PatcherProxy.proxyProperties.get(root).patcher;

        return {replica, basePath};
    } else if (data instanceof Replica) {
        return {replica: data, basePath: ''};
    }
}

export function concatPath(path, suffix) {
    if (path && suffix) {
        return [path, suffix].join('.');
    }

    return path || suffix;
}

export  function extractBasePathAndProperty(path = '') {
    const lastPart = path.lastIndexOf('.');
    if (lastPart === -1) {
        return {property: path, path: ''};
    }

    let property = path.substr(lastPart + 1);
    path = path.substr(0, lastPart);
    return {path, property};
}