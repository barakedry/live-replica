import {Replica, PatchDiff, PatcherProxy, replace, unwrap} from '../client/index.js';
import {LiveReplicaController} from './controller.js';

export function observed(options = {}) {
    return function createObservablePropertyDescriptor(target, propertyName) {

        const previouslyDefinedDescriptor = Object.getOwnPropertyDescriptor(target, propertyName) ||
            Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), propertyName);

        const propertyKey = Symbol(`_${propertyName}`);
        const unwatchKey = Symbol(`unwatch${propertyName}`);
        const reactiveController = Symbol();

        const descriptor = {
            get() { return previouslyDefinedDescriptor?.get?.call(this) || this[propertyKey]},
            set: function(value){

                if (this[propertyKey] === value) { return; }
                const prevValue = this[propertyKey];

                this[unwatchKey]?.();

                const isValueObject = typeof value === 'object' && value !== null;

                // setting a primitive
                if (!isValueObject) {
                    this[propertyKey] = value;
                    previouslyDefinedDescriptor?.set?.call(this, this[propertyKey]);
                    return;
                }

                let proxy;
                if (PatcherProxy.isProxy(value)) {
                    proxy = value;
                } else if (value instanceof PatchDiff) {
                    proxy = value.data
                } else {
                    const replica = new Replica('', {dataObject: value, allowWrite: true});
                    proxy = replica.data;
                }

                this[propertyKey] = proxy;

                if (!this[reactiveController]){
                    this[reactiveController] = new LiveReplicaController(this);
                }

                if (options.onChange && typeof this[options.onChange] === 'function') {
                    this[unwatchKey] = this[reactiveController].watch(proxy, undefined, (patch, diff, val) => {
                        return this[options.onChange]?.(patch, diff, val);
                    });
                } else {
                    this[unwatchKey] = this[reactiveController].watch(proxy);
                }

                if (previouslyDefinedDescriptor?.set) {
                    previouslyDefinedDescriptor?.set?.call(this, proxy);
                } else {
                    this.requestUpdate(propertyName, proxy, prevValue);
                }
            },
            enumerable: false,
            configurable: true,
        };

        return descriptor;
    }
}