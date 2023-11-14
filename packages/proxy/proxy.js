export const proxies = new WeakMap();
export const patchers = new WeakMap();
const ArrayMutatingMethods = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'copyWithin', 'fill']);

function hasProxy(value) {
    return proxies.has(value);
}

export function getProxy(value) {
    return proxies.get(value);
}

export function isProxy(value) {
    return proxies.has(value);
}

export function unwrap(valueOrProxy) {
    if (isProxy(valueOrProxy)) {
        return patchers.get(valueOrProxy).get();
    }

    return valueOrProxy;
}

export function observe(proxy, path, cb) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to observe a non LiveReplica Proxy type`);
    }

    if (typeof path === 'function') {
        cb = path;
        path = '';
    }

    let patcher = patchers.get(proxy);
    if (path) {
        patcher = patcher.at(path);
    }

    return patcher.subscribe(cb);
}

// same as observe
export const subscribe = observe;

export function nextChange(proxy) {

    if (!isProxy(proxy)) {
        throw new TypeError(`trying to call nextChange a non LiveReplica Proxy type`);
    }

    // @ts-ignore
    const patcher = patchers.get(proxy);
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
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to replace a non LiveReplica Proxy type`);
    }

    patchers.get(proxy).set(value, undefined, options);
    return proxy;
}


export function get(proxy, path) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to get from a non LiveReplica Proxy type`);
    }

    return patchers.get(proxy).get(path);
}


export function set(proxy, path, value, options) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to set a non LiveReplica Proxy type`);
    }

    if (!path) {
        throw new TypeError(`path cannot be empty`);
    }

    return patchers.get(proxy).set(value, path, options);
}

export function merge(proxy, partial) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to observe a non LiveReplica Proxy type`);
    }

    return patchers.get(proxy).apply(partial);
}

export function cloneDeep(proxy, path) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to cloneDeep a non LiveReplica Proxy type`);
    }

    return patchers.get(proxy).getClone(path);
}

export function revoke(targetOrProxy) {

    let proxy = targetOrProxy;

    if (hasProxy(targetOrProxy)) {
        proxy = getProxy(targetOrProxy);
    }

    if (!isProxy(proxy)) { return false; }

    // revoke all nested proxies
    Object.values(proxy).forEach((value) => {
        if (typeof value === 'object') {
            revoke(value);
        }
    });

    patchers.delete(patchers.get(proxy));
    proxies.delete(proxy);

    proxy[ProxySymbol].revoke();
    return true;
}

export function create(patchDiff, options = {}) {

    const handlers = {
        get(_target, propKey, receiver) {
            const target = patchDiff.get();

            // handle arrays
            if (Array.isArray(target)) {
                if (typeof target[propKey] === 'function') {
                    const methodName = propKey;
                    if (ArrayMutatingMethods.has(methodName)) {
                        return function mutateProxiedArray(...args) {
                            const copy = target.slice();
                            const result = copy[methodName].apply(copy, args);
                            patchDiff.set(copy);
                            return result;
                        }
                    } else {
                        return target[methodName].bind(target);
                    }
                }
            }

            const value = target[propKey];

            if (typeof value === 'object') {
                if (hasProxy(value)) {
                    return getProxy(value);
                }

                return create(patchDiff.at(propKey), options);
            }

            return value;
        },

        set(_target, propKey, value) {
            const target = patchDiff.get();
            value = unwrap(value);

            if (target[propKey] === value) {
                return true;
            }


            patchDiff.set(value, propKey);
            return true;
        },

        deleteProperty(_target, propKey) {
            const target = patchDiff.get();
            const value = target[propKey];

            patchDiff.delete(propKey);

            if (typeof value === 'object') {
                // revoke proxy
                revoke(value);
            }

            return !!value;
        },

        ownKeys(_target)  {
            const target = patchDiff.get();
            return Reflect.ownKeys(target);
        },

        enumerate (_target) {
            const target = patchDiff.get();
            return target[Symbol.iterator];
        }
    };

    const value = patchDiff.get();
    const revocable = Proxy.revocable(value, handlers);
    const proxy = revocable.proxy;
    proxies.set(value, proxy);
    patchers.set(proxy, patchDiff);
    return proxy;
}