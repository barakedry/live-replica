import {Replica, PatchDiff, PatcherProxy} from '../client/index.js';
import {LiveReplicaController} from './controller.js';

export function observed(options = {}) {
    return function createObservablePropertyDescriptor(target, propertyName) {
        const originalDescriptor = Object.getOwnPropertyDescriptor(target, propertyName);
        const propertyKey = Symbol(`_${propertyName}`);
        const unwatchKey = Symbol(`unwatch${propertyName}`);
        const reactiveController = Symbol();

        const descriptor = {
            get() { return originalDescriptor?.get?.call(this) || this[propertyKey]; },
            set: function(value){

                if (this[propertyKey] === value) { return; }

                this[unwatchKey]?.();

                // setting a primitive
                if (typeof value !== 'object' || value === null) {
                    this[propertyKey] = value;
                    originalDescriptor?.set?.call(this, value);
                    return;
                }

                // setting a non observable object
                if (typeof value === 'object' && !(value instanceof PatchDiff || PatcherProxy.isProxy(value))) {
                    // create observable by creating a local replica
                    const replica = new Replica('', {dataObject: value});
                    this[propertyKey] = replica.data;
                } else {
                    this[propertyKey] = value;
                }

                if (!this[reactiveController]){
                    this[reactiveController] = new LiveReplicaController(this);
                }

                if (options.onChange && typeof this[options.onChange] === 'function') {
                    const onChange = this[options.onChange];
                    this[unwatchKey] = this[reactiveController].watch(this[propertyKey], undefined, (patch, diff, value) => {
                        return onChange.call(this, patch, diff, value);
                    });

                    return onChange.call(this, value);
                } else {
                    this[unwatchKey] = this[reactiveController].watch(this[propertyKey]);
                }

                originalDescriptor?.set?.call(this, value);
            },
            enumerable: false,
            configurable: true,
        };

        return descriptor;
    }
}