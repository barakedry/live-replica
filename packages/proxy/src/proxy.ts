export const proxies = new WeakMap();
export const patchers = new WeakMap();
export const revocables = new WeakMap();
export const softRevoked = new WeakSet();
const ArrayMutatingMethods = new Set<string>(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'copyWithin', 'fill']);

function hasProxy(value: any) {
    return proxies.has(value);
}

export function getProxy(value: any) {
    return proxies.get(value);
}

export function isProxy(proxy: any) {
    return patchers.has(proxy);
}

export function unwrap(valueOrProxy: any) {
    if (isProxy(valueOrProxy)) {
        return patchers.get(valueOrProxy).get();
    }

    return valueOrProxy;
}

export function getPatchDiff(proxy: any) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to getPatchDiff a non LiveReplica Proxy type`);
    }

    return patchers.get(proxy);
}

export function observe(proxy: any, path: string, cb: (...args: any[]) => void) {
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

export function nextChange(proxy: any) {

    if (!isProxy(proxy)) {
        throw new TypeError(`trying to call nextChange a non LiveReplica Proxy type`);
    }

    // @ts-ignore
    const patcher = patchers.get(proxy);
    return new Promise((accept) => {
        let off: (() => void) | null = null;
        off = patcher.subscribe(async (diff: any) => {
            if (!off) {
                setTimeout(() => {
                    off?.();
                    accept(diff);
                }, 0);
            } else {
                off();
                accept(diff);
            }
        });
    });
}

export function replace(proxy: any, value: any, options: any) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to replace a non LiveReplica Proxy type`);
    }

    patchers.get(proxy).set(value, undefined, options);
    return proxy;
}


export function get(proxy: any, path: string) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to get from a non LiveReplica Proxy type`);
    }

    return patchers.get(proxy).get(path);
}


export function set(proxy: any, path: string, value: any, options: any) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to set a non LiveReplica Proxy type`);
    }

    if (!path) {
        throw new TypeError(`path cannot be empty`);
    }

    return patchers.get(proxy).set(value, path, options);
}

export function patch(proxy: any, path: string, value: any, options: any) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to patch a non LiveReplica Proxy type`);
    }

    if (!path) {
        throw new TypeError(`path cannot be empty`);
    }

    return patchers.get(proxy).apply(value, path, options);
}

export function merge(proxy: any, partial: any) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to merge a non LiveReplica Proxy type`);
    }

    return patchers.get(proxy).apply(partial);
}

export function cloneDeep(proxy: any, path: string) {
    if (!isProxy(proxy)) {
        throw new TypeError(`trying to cloneDeep a non LiveReplica Proxy type`);
    }

    return patchers.get(proxy).getClone(path);
}

export function revoke(targetOrProxy: any) {

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
        if (isObject(value)) {
            revoke(value);
        }
    });

    patchers.delete(patchers.get(proxy));
    proxies.delete(proxy);
    softRevoked.add(proxy);
    //revocables.get(proxy).revoke();
    return true;
}

function isObject(value: any) {
    return typeof value === 'object' && value !== null;
}

type ObjectKey = string | number | symbol;

export function create(patchDiff: any, options: any = {}) {

    const mutationOptions = options.immediateFlush ? {} : {defer: true};

    const handlers: ProxyHandler<any> = {
        get(_target: any, propKey: ObjectKey, receiver: any) {
            const target = patchDiff.get();
            // handle arrays
            if (Array.isArray(target)) {
                if (typeof (target as any)[propKey] === 'function') {
                    const methodName = String(propKey);
                    if (ArrayMutatingMethods.has(methodName)) {
                        return function mutateProxiedArray(...args: any[]) {
                            const copy = target.slice();
                            const result = (copy as any)[methodName].apply(copy, args);
                            patchDiff.set(copy);
                            return result;
                        }
                    } else {
                        return (target as any)[methodName].bind(proxy);
                    }
                }
            }

            const value = target?.[propKey];

            if (isObject(value)) {
                if (hasProxy(value)) {
                    return getProxy(value);
                }

                return create(patchDiff.at(propKey), options);
            }

            return value;
        },

        set(_target: any, propKey: ObjectKey, value: any) {

            if (isRevoked()) {
                throw new Error(`Cannot set property on revoked live-replica proxy`);
            }

            const target = patchDiff.get();
            value = unwrap(value);

            if (target[propKey] === value) {
                return true;
            }


            patchDiff.set(value, propKey, mutationOptions);
            return true;
        },

        deleteProperty(_target: any, propKey: ObjectKey) {

            if (isRevoked()) {
                throw new Error(`Cannot delete property on revoked live-replica proxy`);
            }

            const target = patchDiff.get();
            const value = target[propKey];

            patchDiff.remove(propKey, mutationOptions);

            if (isObject(value)) {
                // revoke proxy
                revoke(value);
            }

            return true;
        },

        ownKeys(_target: any)  {
            const target = patchDiff.get();
            return Reflect.ownKeys(target);
        },

        has(_target: any, propKey: ObjectKey) {
            const target = patchDiff.get();
            return isObject(target) && propKey in target;
        },

        getOwnPropertyDescriptor(_target: any, propKey: ObjectKey) {
            const target = patchDiff.get();
            return Reflect.getOwnPropertyDescriptor(target, propKey);
        },

        getPrototypeOf(_target: any) {
            const target = patchDiff.get();
            return Reflect.getPrototypeOf(target);
        },

        setPrototypeOf(_target: any, _proto: any) {
            throw new Error(`Cannot set prototype on live-replica proxy`);
        },

        defineProperty(_target: any, _propKey: ObjectKey, _propDesc: any) {
            throw new Error(`Cannot define property on live-replica proxy`);
        },

        preventExtensions(_target: any) {
            throw new Error(`Cannot preventExtensions on live-replica proxy`);
        },

        isExtensible(_target: any) {
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

    function isRevoked() {
        return softRevoked.has(proxy);
    }

    return proxy;
}

export const createProxy = create;