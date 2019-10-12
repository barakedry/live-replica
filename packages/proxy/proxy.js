/**
 * Created by barakedry on 31/03/2017.
 */
'use strict';
let arrayMutationMethods = {};
['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'].forEach((method) => {
    arrayMutationMethods[method] = true;
});

function set(target, path, value) {

    let levels,
        curr,
        i,
        len;

    if (!path) {
        return value;
    }

    levels = path.split('.');
    len = levels.length;
    i = 0;
    target = target || {};
    curr = target;

    while (i < (len - 1)) {
        if (!curr[levels[i]] || typeof curr[levels[i]] !== 'object') {
            curr[levels[i]] = {};
        }
        curr = curr[levels[i]];
        i++;
    }

    curr[levels[i]] = value;

    return target;
}

function unset(target, path) {

    let levels,
        curr,
        i,
        len;

    if (!path) {
        return value;
    }

    levels = path.split('.');
    len = levels.length;
    i = 0;
    curr = target;

    while (curr && i < (len - 1)) {
        curr = curr[levels[i]];
        i++;
    }

    if (curr && curr[levels[i]]) {
        delete curr[levels[i]];
    }
}

function get(target, path) {

    let levels,
        curr,
        i,
        len;

    if (!path) {
        return target;
    }

    levels = path.split('.');
    len = levels.length;
    i = 0;
    curr = target;

    while (curr && i < len) {
        curr = curr[levels[i]];
        i++;
    }

    return curr;
}

const PatcherProxy = {
    proxies: new WeakMap(),
    proxyProperties: new WeakMap(), // meta tracking properties for the proxies
    create(patcher, path, root, readonly) {
        let patcherRef = patcher.get(path);

        if (!patcherRef || typeof patcherRef !== 'object') {
            throw new Error('no object at path', path);
        }

        let proxy;

        const handlers = {
            get: (target, name) => {
                return this.handleGet(proxy, target, name, readonly);
            },
            has: (target, name) => {
                return Boolean(this.handleGet(proxy, target, name));
            },
            ownKeys: (target) => {
                return this.handleOwnKeys(proxy, target);
            },
            enumerate: () => {
                return proxy[Symbol.iterator];
            }
        };


        if (readonly) {
            handlers.set = (target, name) => {
                throw new Error(`trying to set a value for property "${name}" on a read only object`)
            };

            handlers.deleteProperty = (target, name) => {
                throw new Error(`trying to delete  property "${name}" on a read only object `)
            };

        } else {
            handlers.set = (target, name, newval) => {
                return this.handleSet(proxy, target, name, newval);
            };

            handlers.deleteProperty = (target, name) => {
                return this.handleDelete(proxy, target, name);
            };
        }


        proxy = new Proxy(patcherRef, handlers);

        let properties = {
            patcher,
            path,
            isArray: Array.isArray(patcherRef),
            arrayMethods: {}
        };

        if (root) {
            properties.root = root;
        } else {
            properties.changes = {};
            properties.overrides = {};
            properties.dirty = false;
            properties.pullChanges = function pullChanges() {
                let changes = this.changes;
                let overrides = this.overrides;
                this.changes = {};
                this.overrides = {};
                this.dirty = false;
                return [changes, overrides];
            };
        }

        this.proxies.set(patcherRef, proxy);
        this.proxyProperties.set(proxy, properties);

        return proxy;
    },

    createArrayMethod(proxy, array, methodName, readonly) {

        const proxyServices = this;
        const props = this.proxyProperties.get(proxy);
        const root = this.getRoot(proxy);

        function createArrayMutatingMethod() {
            return function arrayMutatingMethod() {
                proxyServices.commit(root, true);
                const copy = array.slice();
                const ret = copy[methodName].call(copy, ...arguments);

                copy.forEach((item, index) => {
                    proxy[index] = item;
                });

                let len = proxy.length;
                while(len > copy.length) {
                    delete proxy[len -1];
                    len--;
                }

                if (ret === copy) {
                    return proxy;
                } else {
                    return ret;
                }

            }
        }

        if (props.patcher.options.disableSplices) {
            return createArrayMutatingMethod();
        }

        switch (methodName) {
            case 'push': {
                return function push(...items) {
                    proxyServices.commit(root, true);
                    let index = array.length;
                    proxyServices.handleSplice(proxy, index, 0, items);
                    return index + items.length;
                };
            }
            case 'unshift': {
                return function unshift(...items) {
                    proxyServices.commit(root, true);
                    let index = array.length;
                    proxyServices.handleSplice(proxy, index, 0, items);
                    return index + items.length;
                };
            }
            case 'splice': {
                return function splice(index, toRemove, ...items) {
                    proxyServices.commit(root, true);
                    return proxyServices.handleSplice(proxy, toRemove, items);
                };
            }
            case 'pop': {
                return function pop() {
                    proxyServices.commit(root, true);
                    const index = array.length;
                    const removed = this.handleGet(proxy, array, index, readonly);
                    proxyServices.handleSplice(index, 1);
                    return removed;
                };
            }
            case 'shift': {
                return function pop() {
                    if (!array.length) {
                        return undefined;
                    }

                    proxyServices.commit(root, true);
                    const index = 0;
                    const removed = proxyServices.handleGet(proxy, array, index, readonly);
                    proxyServices.handleSplice(index, 1);
                    return removed;
                };
            }
            // mutating methods that are not supported
            default: {
                return createArrayMutatingMethod();
                //throw Error(`${methodName}() is not supported by LiveReplica proxy`);
            }

        }
    },

    getOrCreateArrayMethod(proxy, array, name, readonly) {
        const properties = this.proxyProperties.get(proxy);
        if (!properties.arrayMethods[name]) {
            properties.arrayMethods[name] = this.createArrayMethod(proxy, array, name, readonly);
        }
        return properties.arrayMethods[name];
    },

    getRoot (proxy) {
        return this.proxyProperties.get(proxy).root || proxy;
    },

    getPath(proxy, key) {
        let properties = this.proxyProperties.get(proxy);

        if (properties.path) {
            if (key) {
                return [properties.path, key].join('.');
            } else {
                return properties.path;
            }
        }

        return key;
    },

    handleOwnKeys(proxy, target) {
        let properties = this.proxyProperties.get(proxy);
        let root = this.getRoot(proxy);
        let fullPath = this.getPath(proxy);
        let changes = get(this.proxyProperties.get(root).changes, fullPath);


        if (!changes) {
            return Reflect.ownKeys(target);
        }

        const deleteValue = properties.patcher.options.deleteKeyword;
        const targetKeys = Reflect.ownKeys(target);
        const changedKeys = Reflect.ownKeys(changes);
        for (let i = 0; i < changedKeys.length; i++) {
            let key = changedKeys[i];
            if (changes[key] === deleteValue) {
                let index = targetKeys.indexOf(key);
                targetKeys.splice(index, 1);
            // new
            } else if (!targetKeys.includes(key)) {
                targetKeys.push(key);
            }
        }

        return targetKeys;
    },

    handleGet(proxy, target, name, readonly) {

        let properties = this.proxyProperties.get(proxy);

        if (name === Symbol.iterator) {
            // return this.getIterator(proxy, this.handleOwnKeys(proxy, target, true));
            return this.getIterator(proxy, Object.keys(target));
        }

        if (properties.isArray && arrayMutationMethods[name]) {
            return this.getOrCreateArrayMethod(proxy, target, name, readonly);
        }
        
        let root = this.getRoot(proxy);
        let fullPath = this.getPath(proxy, name);
        let deleteValue = properties.patcher.options.deleteKeyword;
        let value = get(this.proxyProperties.get(root).changes, fullPath);
        let realValue = target[name];

        if (this.proxies.has(realValue)) {
            return this.proxies.get(realValue);
        }

        if (value !== undefined) {
            if (deleteValue === value) {
                return undefined;
            }

            return value;
        }

        if (realValue !== undefined) {
            // if real value is an object we must return accessor proxy
            if (typeof realValue === 'object') {
                return this.create(properties.patcher, fullPath, this.getRoot(proxy), readonly);
            }

            return realValue;
        }

        return undefined;
    },

    handleSet(proxy, target, name, newval) {
        let properties = this.proxyProperties.get(proxy);
        let root = this.getRoot(proxy);
        let fullPath = this.getPath(proxy, name);
        if (typeof newval === 'object' && typeof target[name] === 'object') {

            // trying to assign a proxy for some reason
            if (this.proxyProperties.has(newval)) {
                // trying to assign the same proxy object
                const p = this.proxyProperties.get(newval).patcher;

                if (newval === p.get()) {
                    return; // do nothing
                } else {
                    throw Error(`trying to assign an object that already exists to property ${name} assignment of cyclic references`);
                }
            }


            let fixedPath = fullPath
            if (properties.patcher && properties.patcher._path) {
                fixedPath = [properties.patcher._path, fullPath].join('.');
            }
            this.proxyProperties.get(root).overrides[fixedPath] = true;
        }

        this.proxyProperties.get(root).dirty = true;
        set(this.proxyProperties.get(root).changes, fullPath, newval);
        this.commit(root);

        return true;
    },

    handleDelete(proxy, target, name) {
        let properties = this.proxyProperties.get(proxy);
        let root = this.getRoot(proxy);
        let fullPath = this.getPath(proxy, name);
        let rootChangeTracker = this.proxyProperties.get(root).changes;

        rootChangeTracker.dirty = true;
        if (target.hasOwnProperty(name)) {
            set(rootChangeTracker, fullPath, properties.patcher.options.deleteKeyword);
        } else {
            unset(rootChangeTracker, fullPath);
        }

        this.commit(root);

        return true;
    },


    handleSplice(proxy, index, itemsToRemove, itemsToAdd) {
        let properties = this.proxyProperties.get(proxy);
        let patcher = properties.patcher;
        patcher.splice(this.getPath(proxy), {index, itemsToRemove, ...itemsToAdd});

    },

    getIterator(proxy, keys) {
        return function() {
            return {
                i: 0,
                next() {
                    if (this.i < keys.length) {
                        return { value: proxy[keys[this.i++]], done: false };
                    }
                    return { done: true };
                }
            };
        }.bind(proxy);
    },
    
    commit(proxy, immediate = false) {
        let properties = this.proxyProperties.get(proxy);

        if (!properties.dirty) {  return; }

        const flush = () => {
            if (properties.nextChangeTimeout) {
                clearTimeout(properties.nextChangeTimeout);
                properties.nextChangeTimeout = 0;
            }

            let patcher = properties.patcher;
            let [patch, overrides] = properties.pullChanges();
            let options = {
                overrides
            };
            patcher.apply(patch, null, options);
        };

        if (immediate) {
            flush();
        } else {
            this.defer(proxy, flush);
        }
    },

    defer(proxy, cb) {
        // defer more
        let properties = this.proxyProperties.get(proxy);
        if (properties.nextChangeTimeout) {
            clearTimeout(properties.nextChangeTimeout);
            properties.nextChangeTimeout = 0;
        }
        properties.nextChangeTimeout = setTimeout(cb, 0);
    }
};

// export default Proxy;
module.exports = PatcherProxy;
