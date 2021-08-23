export function replicaByData(data) {
    if (LiveReplica.Proxy.proxyProperties.has(data)) {
        const root = LiveReplica.Proxy.getRoot(data);
        const basePath = LiveReplica.Proxy.getPath(data);
        const replica = LiveReplica.Proxy.proxyProperties.get(root).patcher;

        return {replica, basePath};
    } else if (data instanceof LiveReplica.Replica) {
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