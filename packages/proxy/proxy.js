export const proxies = new WeakMap();
export const patchers = new WeakMap();
export const revocables = new WeakMap();
const ArrayMutatingMethods = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'copyWithin', 'fill']);

function hasProxy(value) {
    return proxies.has(value);
}

export function getProxy(value) {
    return proxies.get(value);
}

export function isProxy(proxy) {
    return patchers.has(proxy);
}

export function unwrap(valueOrProxy) {
    if (isProxy(valueOrProxy)) {
        return patchers.get(valueOrProxy).get();
    }

    return valueOrProxy;
}

export function getPatchDiff(proxy) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to getPatchDiff a non LiveReplica Proxy type`);
    }

    return patchers.get(proxy);
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
        let off = null;
        off = patcher.subscribe(async (diff) => {
            if (!off) {
                setTimeout(() => {
                    off();
                    accept(diff);
                }, 0);
            } else {
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
        throw new TypeError(`trying to merge a non LiveReplica Proxy type`);
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


    let values;
    try {
        values = Object.values(proxy);
    } catch (e) {
        return false;
    }


    // revoke all nested proxies
    values.forEach((value) => {
        if (typeof value === 'object' && value !== null) {
            revoke(value);
        }
    });

    patchers.delete(patchers.get(proxy));
    proxies.delete(proxy);
    revocables.get(proxy).revoke();
    return true;
}

export function create(patchDiff, options = {}) {

    const mutationOptions = options.immediateFlush ? {} : {defer: true};

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

            if (typeof value === 'object' && value !== null) {
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


            patchDiff.set(value, propKey, mutationOptions);
            return true;
        },

        deleteProperty(_target, propKey) {
            const target = patchDiff.get();
            const value = target[propKey];

            patchDiff.remove(propKey, mutationOptions);

            if (typeof value === 'object' && value !== null) {
                // revoke proxy
                revoke(value);
            }

            return !!value;
        },

        ownKeys(_target)  {
            const target = patchDiff.get();
            return Reflect.ownKeys(target);
        },

        has(_target, propKey) {
            const target = patchDiff.get();
            return propKey in target;
        },

        getOwnPropertyDescriptor(_target, propKey) {
            const target = patchDiff.get();
            return Reflect.getOwnPropertyDescriptor(target, propKey);
        },

        getPrototypeOf(_target) {
            const target = patchDiff.get();
            return Reflect.getPrototypeOf(target);
        },

        setPrototypeOf(_target, _proto) {
            throw new Error(`Cannot set prototype on live-replica proxy`);
        },

        defineProperty(_target, _propKey, _propDesc) {
            throw new Error(`Cannot define property on live-replica proxy`);
        },

        preventExtensions(_target) {
            throw new Error(`Cannot preventExtensions on live-replica proxy`);
        },

        isExtensible(_target) {
            throw new Error(`Cannot isExtensible on live-replica proxy`);
        },

    };

    if (options.readonly) {
        handlers.set = () => {
            throw new Error(`Cannot set property on readonly live-replica proxy`);
        };

        handlers.deleteProperty = () => {
            throw new Error(`Cannot delete property on readonly live-replica proxy`);
        }
    }

    const value = patchDiff.get();
    const revocable = Proxy.revocable(value, handlers);
    const proxy = revocable.proxy;
    revocables.set(proxy, revocable);
    proxies.set(value, proxy);
    patchers.set(proxy, patchDiff);
    return proxy;
}

export const createProxy = create;