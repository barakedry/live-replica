'use strict';

module.exports = function ProxyDataBindingMixin(base) {

    let arrayMutationMethods = {};
    ['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'].forEach((method) => {
        arrayMutationMethods[method] = true;
    });

    function createArrayMethod(array, methodName, path, element) {
        switch (methodName) {
            case 'push': {
                return function push(...items) {
                    let index = array.length;
                    let retVal = array.push(...items);
                    //console.log(path, ...items, JSON.stringify([{index, removed: [], addedCount: items.length, object: array, type: 'splice'}], 4, 4));
                    element.notifySplices(path, [{index, removed: [], addedCount: items.length, object: array, type: 'splice'}]);
                    return retVal;
                };
                break;
            }
            case 'unshift': {
                return function unshift(...items) {
                    let index = 0;
                    let retVal = array.shift(...items);
                    element.notifySplices(path, [{index, removed: [], addedCount: items.length, object: array, type: 'splice'}]);
                    return retVal;
                };
                break;
            }
            case 'splice': {
                return function splice(index, toRemove, ...items) {
                    let removed = array.splice(index, toRemove, ...items);
                    element.notifySplices(path, [{index, removed, addedCount: items.length, object: array, type: 'splice'}]);
                    console.log('notifySplices', path, [{index, removed, addedCount: items.length, object: array, type: 'splice'}]);
                    return removed;
                };
                break;
            }
            case 'pop': {
                return function pop() {
                    let index = array.length;
                    let removed = array.pop();
                    element.notifySplices(path, [{index, removed: [removed], addedCount: 0, object: array, type: 'splice'}] );
                    return removed;
                };
                break;
            }
            case 'shift': {
                return function shift() {
                    let removed = array.unshift();
                    element.notifySplices(path, [{index: 0, removed: [removed], addedCount: 0, object: array, type: 'splice'}] );
                    return removed;
                };
                break;
            }
        }
    }

    function getOrCreateArrayMethod(target, methodName, path, element) {
        let methods = element.__proxiesMethods.get(target);
        if (!methods) {
            methods = {};
            element.__proxiesMethods.set(target, methods);
        }

        if (!methods[methodName]) {
            methods[methodName] = createArrayMethod(target, methodName, path, element);

        }

        return methods[methodName];
    }


    function createProxy(object, path, element) {

        let isArray = Array.isArray(object);
        let proxy = new Proxy(object, {
            get: (target, name) => {

                if (isArray && arrayMutationMethods[name]) {
                    return getOrCreateArrayMethod(target, name, path, element);
                }

                let subProxy = element.__proxies.get(target[name]);
                if (subProxy) {
                    return subProxy;
                }

                if (typeof target[name] === 'object') {
                    let subPath  = path ? [path, name].join('.') : name;
                    return createProxy(target[name], subPath, element);
                }

                return target[name];
            },
            set: (target, name, newval) => {

                target[name] = newval;
                if (isArray) {
                    element.notifySplices(path);
                } else {
                    element.notifyPath([path, name].join('.'));
                }

                return true;
            },
            deleteProperty: (target, name) => {
                delete target[name];
                element.notifyPath([path, name].join('.'));
                return true;
            }
        });

        element.__proxies.set(object, proxy);
        return proxy;
    }

    return class extends base {
        constructor() {
            super();
            this.__proxies = new WeakMap();
            this.__proxiesMethods = new WeakMap();
        }

        proxyBind (property, object) {
            this[property] = createProxy(object, property, this);
            return this[property];
        }
    }
};