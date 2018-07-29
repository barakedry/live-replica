/**
 * Created by barakedry on 31/03/2017.
 */
'use strict';
const _ = require('lodash');

let arrayMutationMethods = {};
['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'].forEach((method) => {
    arrayMutationMethods[method] = true;
});

const PatcherProxy = {
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
            arrayMethods: {},
            childs: {}
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
                copy[methodName].call(copy, ...arguments);
                copy.forEach((item, index) => {
                    proxy[index] = item;
                });
                return proxy;
            }
        }

        if (props.patcher.disableSplices) {
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

    getOrCreateChildProxyForKey(parent, key, readonly) {
        let parentProperties = this.proxyProperties.get(parent);

        if (parentProperties.childs[key]) {
            return parentProperties.childs[key];
        }

        let childProxy = this.create(parentProperties.patcher, this.getPath(parent, key), this.getRoot(parent), readonly);
        parentProperties.childs[key] = childProxy;

        return childProxy;
    },

    handleGet(proxy, target, name, readonly) {

        let properties = this.proxyProperties.get(proxy);

        if (properties.isArray && arrayMutationMethods[name]) {
            return this.getOrCreateArrayMethod(proxy, target, name, readonly);
        }
        
        let root = this.getRoot(proxy);
        let fullPath = this.getPath(proxy, name);
        let deleteValue = properties.patcher.options.deleteKeyword;
        let value = _.get(this.proxyProperties.get(root).changes, fullPath);

        if (properties.childs[name]) {
            return properties.childs[name];
        }

        if (value) {
            if (deleteValue === value) {
                return undefined;
            }

            return value;
        }

        let realValue = target[name];
        if (realValue) {
            // if real value is an object we must return accessor proxy
            if (typeof realValue === 'object') {
                return this.getOrCreateChildProxyForKey(proxy, name, readonly);
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

            this.proxyProperties.get(root).overrides[fullPath] = true;
        }

        if (properties.childs[name]) {
            this.proxyProperties.delete(properties.childs[name]);
            delete properties.childs[name];
        }

        this.proxyProperties.get(root).dirty = true;
        _.set(this.proxyProperties.get(root).changes, fullPath, newval);
        this.commit(root);

        return true;
    },

    handleDelete(proxy, target, name) {
        let properties = this.proxyProperties.get(proxy);
        let root = this.getRoot(proxy);
        let fullPath = this.getPath(proxy, name);
        let rootChangeTracker = this.proxyProperties.get(root).changes;

        rootChangeTracker.dirty = true;
        if (target[name]) {
            _.set(rootChangeTracker, fullPath, properties.patcher.options.deleteKeyword);
        } else {
            _.unset(rootChangeTracker, fullPath);
        }

        if (properties.childs[name]) {
            this.proxyProperties.delete(properties.childs[name]);
            delete properties.childs[name];
        }

        this.commit(root);

        return true;
    },


    handleSplice(proxy, index, itemsToRemove, itemsToAdd) {
        let properties = this.proxyProperties.get(proxy);
        let patcher = properties.patcher;
        patcher.splice(this.getPath(proxy), index, itemsToRemove, ...itemsToAdd);

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
