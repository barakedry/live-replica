import PatcherProxy from "./proxy.js";

export function observe(object, path, cb) {
    if (!PatcherProxy.isProxy(object)) {
        throw new TypeError(`trying to observe a non LiveReplica Proxy type`);
    }

    if (typeof path === 'function') {
        cb = path;
    }

    const patcher = PatcherProxy.getPatchDiff(object);
    return patcher.subscribe(cb);
}

export function nextChange(object) {

    if (!PatcherProxy.isProxy(object)) {
        throw new TypeError(`trying to observe a non LiveReplica Proxy type`);
    }

    // @ts-ignore
    const patcher = PatcherProxy.getPatchDiff(object);
    return new Promise((accept) => {
        let off = patcher.subscribe((diff) => {
            if (off) {
                off();
                accept(diff);
            }
        });
    });
}

export function replace(proxy, value, options) {
    if (!PatcherProxy.isProxy(proxy)) {
        throw new TypeError(`trying to observe a non LiveReplica Proxy type`);
    }

    PatcherProxy.getPatchDiff(proxy).set(value, undefined, options);
    return proxy;
}


export function get(proxy, path) {
    if (!PatcherProxy.isProxy(proxy)) {
        throw new TypeError(`trying to observe a non LiveReplica Proxy type`);
    }

    return PatcherProxy.getPatchDiff(proxy).get(path);
}


export function set(proxy, path, value, options) {
    if (!PatcherProxy.isProxy(proxy)) {
        throw new TypeError(`trying to observe a non LiveReplica Proxy type`);
    }

    if (!path) {
        throw new TypeError(`path cannot be empty`);
    }

    if (PatcherProxy.isProxy(value)) {
        value = get(value);
    }

    return PatcherProxy.getPatchDiff(proxy).set(value, path, options);
}

export function merge(proxy, partial) {
    if (!PatcherProxy.isProxy(proxy)) {
        throw new TypeError(`trying to observe a non LiveReplica Proxy type`);
    }

    return PatcherProxy.getPatchDiff(proxy).apply(partial);
}

export function deepClone(proxy, path) {
    if (!PatcherProxy.isProxy(proxy)) {
        throw new TypeError(`trying to observe a non LiveReplica Proxy type`);
    }

    return PatcherProxy.getPatchDiff(proxy).getClone(path);
}
