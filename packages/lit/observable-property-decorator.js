import {PatchDiff, PatcherProxy} from '../client/index.js';
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

                const onChange = options.onChange && typeof this[options.onChange] === 'function' ? this[options.onChange] : () => {};

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
                    const patchDiff = new PatchDiff(value, {readonly: false});
                    proxy = patchDiff.data;
                }

                this[propertyKey] = proxy;

                if (previouslyDefinedDescriptor?.set) {
                    previouslyDefinedDescriptor?.set?.call(this, proxy);
                } else {
                    this.requestUpdate(propertyName, proxy, prevValue);
                }

                if (!this[reactiveController]){
                    this[reactiveController] = new LiveReplicaController(this);
                }

                this[unwatchKey] = this[reactiveController].watch(proxy, undefined, onChange);

                //onChange(value, {});
            },
            enumerable: false,
            configurable: true,
        };

        return descriptor;
    }
}