import {PatchDiff, isProxy, get, getPatchDiff} from '../client/index.js';
import {LiveReplicaController} from './controller.js';

const isRevoked = (obj) => {
    if (!obj || 'object' != typeof obj) {
        return false;
    }
    try {
        // detect revoked proxy
        Symbol() in obj;
        return false;
    } catch (error) {
        return true;
    }
};

export function observed(options = {throttleUpdatesDelay: 0}) {
    return function createObservablePropertyDescriptor(target, propertyName) {

        const previouslyDefinedDescriptor = Object.getOwnPropertyDescriptor(target, propertyName) ||
            Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), propertyName);

        const propertyKey = Symbol(`_${propertyName}`);
        const unwatchKey = Symbol(`unwatch${propertyName}`);
        const lastSetKey = Symbol(`last_${propertyName}`);
        const reactiveController = Symbol();

        let revoked = false;
        const descriptor = {
            get() {
                if (revoked) {
                    return undefined;
                }

                return previouslyDefinedDescriptor ? previouslyDefinedDescriptor?.get?.call(this) : this[propertyKey];
            },
            set: function setObservable(value){

                revoked = false;

                const onChange = options.onChange && typeof this[options.onChange] === 'function' ? this[options.onChange] : () => {};

                if (this[propertyKey] === value || this[lastSetKey] === value) { return; }
                const prevValue = this[propertyKey];
                this[lastSetKey] = value;

                this[unwatchKey]?.();

                const isValueObject = typeof value === 'object' && value !== null;

                // setting a primitive
                if (!isValueObject) {
                    this[propertyKey] = value;
                    previouslyDefinedDescriptor?.set?.call(this, this[propertyKey]);
                    return;
                }

                let proxy;
                if (isProxy(value)) {
                    proxy = value;
                } else if (value instanceof PatchDiff) {
                    proxy = value.getData(options);
                } else {
                    const patchDiff = new PatchDiff(value, {readonly: false});
                    proxy = patchDiff.getData(options);
                }

                const patchDiff = getPatchDiff(proxy);

                this[propertyKey] = proxy;

                if (previouslyDefinedDescriptor?.set) {
                    previouslyDefinedDescriptor?.set?.call(this, proxy);
                } else {
                    this.requestUpdate(propertyName, proxy, prevValue);
                }

                if (!this[reactiveController]){
                    this[reactiveController] = new LiveReplicaController(this);
                }

                let wasDeleted = false;
                this[unwatchKey] = this[reactiveController].watch(patchDiff, undefined, (diff, changeInfo, value, selfDelete) => {

                    if (selfDelete) {
                        proxy = undefined;
                        this[propertyKey] = undefined;
                        wasDeleted = true;
                        previouslyDefinedDescriptor?.set?.call(this, this[propertyKey]);
                    } else if (wasDeleted && value && (typeof value === 'object')) {
                        setObservable.call(this, patchDiff);
                    }

                    if (changeInfo.selfDelete) {
                        return false;
                    }

                    revoked = isRevoked(this[propertyKey]);
                    return onChange.call(this, diff, changeInfo);
                }, options.throttleUpdatesDelay);
            },
            enumerable: false,
            configurable: true,
        };

        return descriptor;
    }
}

/*
export function watchPath(propertyName, path = '', deep = false) {
    return (proto, decoratedFnName) => {
        const connectedCallback = proto.connectedCallback;
        const disconnectedCallback = proto.disconnectedCallback;
        const propertyKey = Symbol(`_${propertyName}`);
        let unwatch;
        proto.connectedCallback = function() {
            connectedCallback?.call(this);

            unwatch = watch(this[propertyKey], path, (diff, changeInfo) => {
                if (deep) {
                    this[decoratedFnName](get(this[propertyKey], path), diff, changeInfo);
                } else {
                    if (typeof diff !== 'object' || changeInfo.hasAddedObjects) {
                        this[decoratedFnName](diff);
                    }
                }
            });
        }

        proto.disconnectedCallback = function() {
            disconnectedCallback?.call(this);
            unwatch?.();
        }
    };
}
 */