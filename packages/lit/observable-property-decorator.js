import {PatchDiff, isProxy} from '../client/index.js';
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

export function observed(options = {}) {
    return function createObservablePropertyDescriptor(target, propertyName) {

        const previouslyDefinedDescriptor = Object.getOwnPropertyDescriptor(target, propertyName) ||
            Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), propertyName);

        const propertyKey = Symbol(`_${propertyName}`);
        const unwatchKey = Symbol(`unwatch${propertyName}`);
        const reactiveController = Symbol();


        let revoked = false;
        const descriptor = {
            get() {
                if (revoked) {
                    return undefined;
                }

                return previouslyDefinedDescriptor ? previouslyDefinedDescriptor?.get?.call(this) : this[propertyKey];
            },
            set: function(value){

                revoked = false;

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
                if (isProxy(value)) {
                    proxy = value;
                } else if (value instanceof PatchDiff) {
                    proxy = value.getData(options);
                } else {
                    const patchDiff = new PatchDiff(value, {readonly: false});
                    proxy = patchDiff.getData(options);
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

                this[unwatchKey] = this[reactiveController].watch(proxy, undefined, (diff, changeInfo) => {
                    if (changeInfo.selfDelete) {
                        return false;
                    }

                    revoked = isRevoked(this[propertyKey]);
                    return onChange.call(this, diff, changeInfo);
                });
            },
            enumerable: false,
            configurable: true,
        };

        return descriptor;
    }
}