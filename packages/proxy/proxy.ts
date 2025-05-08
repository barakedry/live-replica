// @ts-nocheck
// TODO: Add proper types in a later pass

import type {
  LiveReplicaProxy,
  PatchDiff,
  SubscribeCallback,
  UnsubscribeCallback,
  MutationOptions,
  MergeOptions
} from '@live-replica/live-replica';

export const proxies: WeakMap<object, LiveReplicaProxy<any>> = new WeakMap();
export const patchers: WeakMap<object, PatchDiff<any>> = new WeakMap();
export const revocables: WeakMap<object, { proxy: any; revoke: () => void }> = new WeakMap();
export const softRevoked: WeakSet<object> = new WeakSet();
const ArrayMutatingMethods = new Set<string>(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'copyWithin', 'fill']);

export function hasProxy(value: object): boolean {
  return proxies.has(value);
}

export function getProxy<T = any>(value: T): LiveReplicaProxy<T> | undefined {
  return proxies.get(value as object) as LiveReplicaProxy<T> | undefined;
}

export function isProxy(proxy: object): boolean {
  return patchers.has(proxy);
}

export function unwrap<T = any>(valueOrProxy: T): T {
  if (isProxy(valueOrProxy as object)) {
    return (patchers.get(valueOrProxy as object) as PatchDiff<T>).get();
  }
  return valueOrProxy;
}

export function getPatchDiff<T = any>(proxy: LiveReplicaProxy<T>): PatchDiff<T> {
  if (!isProxy(proxy as object)) {
    throw new TypeError('trying to getPatchDiff a non LiveReplica Proxy type');
  }
  return patchers.get(proxy as object) as PatchDiff<T>;
}

export function observe<T = any>(
  proxy: LiveReplicaProxy<T>,
  path: string | SubscribeCallback<T>,
  cb?: SubscribeCallback<T>
): UnsubscribeCallback {
  if (!isProxy(proxy as object)) {
    throw new TypeError('trying to observe a non LiveReplica Proxy type');
  }
  let actualPath: string = '';
  let actualCb: SubscribeCallback<T>;
  if (typeof path === 'function') {
    actualCb = path;
    path = '';
  } else {
    actualPath = path;
    actualCb = cb!;
  }
  let patcher = patchers.get(proxy as object) as PatchDiff<T>;
  if (actualPath) {
    patcher = patcher.at(actualPath) as PatchDiff<T>;
  }
  return patcher.subscribe(actualCb);
}

export const subscribe = observe;

export function nextChange<T = any>(proxy: LiveReplicaProxy<T>): Promise<Partial<T>> {
  if (!isProxy(proxy as object)) {
    throw new TypeError('trying to call nextChange a non LiveReplica Proxy type');
  }
  // @ts-ignore
  const patcher = patchers.get(proxy as object) as PatchDiff<T>;
  return new Promise<Partial<T>>((accept) => {
    let off: UnsubscribeCallback | null = null;
    off = patcher.subscribe(async (diff: Partial<T>) => {
      if (!off) {
        setTimeout(() => {
          off!();
          accept(diff);
        }, 0);
      } else {
        off();
        accept(diff);
      }
    });
  });
}

export function replace<T = any>(proxy: LiveReplicaProxy<T>, value: T, options?: MutationOptions): LiveReplicaProxy<T> {
  if (!isProxy(proxy as object)) {
    throw new TypeError('trying to replace a non LiveReplica Proxy type');
  }
  (patchers.get(proxy as object) as PatchDiff<T>).set(value, undefined, options);
  return proxy;
}

export function get<T = any>(proxy: LiveReplicaProxy<T>, path: string): any {
  if (!isProxy(proxy as object)) {
    throw new TypeError('trying to get from a non LiveReplica Proxy type');
  }
  return (patchers.get(proxy as object) as PatchDiff<T>).get(path);
}

export function set<T = any>(proxy: LiveReplicaProxy<T>, path: string, value: any, options?: MutationOptions): void {
  if (!isProxy(proxy as object)) {
    throw new TypeError('trying to set a non LiveReplica Proxy type');
  }
  if (!path) {
    throw new TypeError('path cannot be empty');
  }
  (patchers.get(proxy as object) as PatchDiff<T>).set(value, path, options);
}

export function patch<T = any>(proxy: LiveReplicaProxy<T>, path: string, value: any, options?: MutationOptions): void {
  if (!isProxy(proxy as object)) {
    throw new TypeError('trying to patch a non LiveReplica Proxy type');
  }
  if (!path) {
    throw new TypeError('path cannot be empty');
  }
  (patchers.get(proxy as object) as PatchDiff<T>).apply(value, path, options as MergeOptions);
}

export function merge<T = any>(proxy: LiveReplicaProxy<T>, partial: Partial<T>): void {
  if (!isProxy(proxy as object)) {
    throw new TypeError('trying to merge a non LiveReplica Proxy type');
  }
  (patchers.get(proxy as object) as PatchDiff<T>).apply(partial);
}

export function cloneDeep<T = any>(proxy: LiveReplicaProxy<T>, path?: string): T {
  if (!isProxy(proxy as object)) {
    throw new TypeError('trying to cloneDeep a non LiveReplica Proxy type');
  }
  return (patchers.get(proxy as object) as PatchDiff<T>).getClone(path);
}

export function revoke(targetOrProxy: object): boolean {
  let proxy: object = targetOrProxy;
  if (hasProxy(targetOrProxy)) {
    proxy = getProxy(targetOrProxy) as object;
  }
  if (!isProxy(proxy)) {
    return false;
  }
  let values: any[];
  try {
    values = Object.values(proxy);
  } catch (e) {
    return false;
  }
  values.forEach((value: any) => {
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

function isObject(value: any): value is object {
  return typeof value === 'object' && value !== null;
}

export function create<T = any>(patchDiff: PatchDiff<T>, options: { readonly?: boolean; immediateFlush?: boolean } = {}): LiveReplicaProxy<T> {
  const mutationOptions = options.immediateFlush ? {} : { defer: true };
  const handlers: ProxyHandler<any> = {
    get(_target: any, propKey: string, receiver: any) {
      const target = patchDiff.get();
      if (Array.isArray(target)) {
        if (typeof target[propKey] === 'function') {
          const methodName = propKey;
          if (ArrayMutatingMethods.has(methodName)) {
            return function mutateProxiedArray(...args: any[]) {
              const copy = target.slice();
              const result = copy[methodName].apply(copy, args);
              patchDiff.set(copy);
              return result;
            };
          } else {
            return target[methodName].bind(proxy);
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
    set(_target: any, propKey: string, value: any) {
      if (isRevoked()) {
        throw new Error('Cannot set property on revoked live-replica proxy');
      }
      const target = patchDiff.get();
      value = unwrap(value);
      if (target[propKey] === value) {
        return true;
      }
      patchDiff.set(value, propKey, mutationOptions);
      return true;
    },
    deleteProperty(_target: any, propKey: string) {
      if (isRevoked()) {
        throw new Error('Cannot delete property on revoked live-replica proxy');
      }
      const target = patchDiff.get();
      const value = target[propKey];
      patchDiff.remove(propKey, mutationOptions);
      if (isObject(value)) {
        revoke(value);
      }
      return true;
    },
    ownKeys(_target: any) {
      const target = patchDiff.get();
      return Reflect.ownKeys(target);
    },
    has(_target: any, propKey: string) {
      const target = patchDiff.get();
      return isObject(target) && propKey in target;
    },
    getOwnPropertyDescriptor(_target: any, propKey: string) {
      const target = patchDiff.get();
      return Reflect.getOwnPropertyDescriptor(target, propKey);
    },
    getPrototypeOf(_target: any) {
      const target = patchDiff.get();
      return Reflect.getPrototypeOf(target);
    },
    setPrototypeOf(_target: any, _proto: any) {
      throw new Error('Cannot set prototype on live-replica proxy');
    },
    defineProperty(_target: any, _propKey: string, _propDesc: any) {
      throw new Error('Cannot define property on live-replica proxy');
    },
    preventExtensions(_target: any) {
      throw new Error('Cannot preventExtensions on live-replica proxy');
    },
    isExtensible(_target: any) {
      throw new Error('Cannot isExtensible on live-replica proxy');
    },
  };
  if (options.readonly) {
    handlers.set = () => {
      throw new Error('Cannot set property on readonly live-replica proxy');
    };
    handlers.deleteProperty = () => {
      throw new Error('Cannot delete property on readonly live-replica proxy');
    };
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