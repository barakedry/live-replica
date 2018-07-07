/**
 * Created by barakedry on 31/03/2017.
 */
'use strict';
import _ from 'lodash';

const Proxy = {
    proxyProperties: new WeakMap(), // meta tracking properties for the proxies
    create(patcher, path, root) {
        let patcherRef = patcher.get(path);

        if (!patcherRef || typeof patcherRef !== 'object') {
            throw new Error('no object at path', path);
        }

        let proxy = new Proxy(patcherRef, {
            get: (target, name) => {
                return this.handleGet(proxy, target, name);
            },
            set: (target, name, newval) => {
                return this.handleSet(proxy, target, name, newval);
            },
            has: (target, name) => {
                return Boolean(this.handleSet(proxy, target, name));
            },
            deleteProperty: (target, name) => {
                return this.handleDelete(proxy, target, name);
            }
        });

        let properties = {
            patcher,
            path,
            childs: {}
        };

        if (root) {
            properties.root = root;
        } else {
            properties.changes = {};
            properties.overrides = {};
            properties.pullChanges = function pullChanges() {
                let changes = this.changes;
                let overrides = this.overrides;
                this.changes = {};
                this.overrides = {};

                return [changes, overrides];
            };
        }

        this.proxyProperties.set(proxy, properties);

        return proxy;
    },

    getRoot (proxy) {
        return this.proxyProperties.get(proxy).root || proxy;
    },

    getPath(proxy, key) {
        let properties = this.proxyProperties.get(proxy);

        if (properties.path) {
            return [properties.path, key].join('.');
        }

        return key;
    },

    getOrCreateChildProxyForKey(parent, key) {
        let praentProperties = this.proxyProperties.get(parent);

        if (praentProperties.childs[key]) {
            return praentProperties.childs[key];
        }

        let childProxy = this.create(praentProperties.patcher, this.getPath(parent, key), this.getRoot(parent));
        praentProperties.childs[key] = childProxy;

        return childProxy;
    },

    handleGet(proxy, target, name) {
        let properties = this.proxyProperties.get(proxy);
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
                return this.getOrCreateChildProxyForKey(proxy, name);
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
            this.proxyProperties.get(root).overrides[fullPath] = true;
        }

        if (properties.childs[name]) {
            this.proxyProperties.delete(properties.childs[name]);
            delete properties.childs[name];
        }

        _.set(this.proxyProperties.get(root).changes, fullPath, newval);
        this.patchChanges(root);

        return true;
    },

    handleDelete(proxy, target, name) {
        let properties = this.proxyProperties.get(proxy);
        let root = this.getRoot(proxy);
        let fullPath = this.getPath(proxy, name);
        let rootChangeTracker = this.proxyProperties.get(root).changes;

        if (target[name]) {
            _.set(rootChangeTracker, fullPath, properties.patcher.options.deleteKeyword);
        } else {
            _.unset(rootChangeTracker, fullPath);
        }

        if (properties.childs[name]) {
            this.proxyProperties.delete(properties.childs[name]);
            delete properties.childs[name];
        }

        this.patchChanges(root);

        return true;
    },

    handleSplice(proxy) {
        let properties = this.proxyProperties.get(proxy);
        let root = this.getRoot(proxy);
        let fullPath = properties.path;
        let value = _.get(this.proxyProperties.get(root).changes, fullPath);
        if (value) {
            if (Array.isArray(value)) {
                return value;
            }
        }
    },

    patchChanges(proxy) {
        this.defer(proxy, () => {
            let properties = this.proxyProperties.get(proxy);
            let patcher = properties.patcher;
            let [patch, overrides] = properties.pullChanges();
            let options = {
                overrides
            };
            patcher.apply(patch, null, options);
        });
    },

    defer(proxy, cb) {
        let properties = this.proxyProperties.get(proxy);
        if (properties.nextChangeTimeout) {
            clearTimeout(properties.nextChangeTimeout);
            properties.nextChangeTimeout = 0;
        }

        properties.nextChangeTimeout = setTimeout(cb, 0);
    }
};

// export default Proxy;
module.exports = Proxy;
