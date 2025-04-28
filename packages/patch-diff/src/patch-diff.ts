import { EventEmitter, PATH_EVENT_PREFIX } from '@live-replica/events';
import {
  concatPath,
  firstKey,
  pickWithKeys,
  wrapByPath,
  splitPathAndLastKey,
  parentPath,
  fixNumericParts,
  hasSamePrototype,
  createWrapperWithLastKey,
  pushKeyToPath,
  SERIALIZED_FUNCTION
} from '@live-replica/utils';
import { DiffTracker } from "./diff-tracker";
import { create, isProxy, revoke, unwrap } from "@live-replica/proxy";
import {
  PatchDiffOptions,
  SpliceParams,
  DiffInfo,
  SubscribeCallback,
  UnsubscribeCallback,
  GetAllResult,
  IPatchDiff,
  MutationOptions,
  MergeOptions,
  ProxyOptions,
  KeyList
} from './types';

import isObject from 'lodash-es/isObject';
import isString from 'lodash-es/isString';
import isEqual from 'lodash-es/isEqual';
import get from 'lodash-es/get';
import keys from 'lodash-es/keys';
import isArray from 'lodash-es/isArray';
import isUndefined from 'lodash-es/isUndefined';

const _isObject = isObject;
const _isString = isString;
const _isEqual = isEqual;
const _get = get;
const _keys = keys;
const _isArray = isArray;
const _isUndefined = isUndefined;

const logError = (msg: string): void => { console.error('LiveReplica PatchDiff: ' + msg); };

const eventsWithoutPrepend = new Set(['destroyed', 'error', '_subscribed', '_synced']);

const _isFunction = (obj: unknown): obj is Function => typeof obj === 'function';

function createByType(obj: unknown): any[] | Record<string, any> {
  if (_isArray(obj)) {
    return [];
  }
  return {};
}

function aggregate(patch1: Record<string, any> | null, patch2: Record<string, any>): Record<string, any> {
  if (!patch1) {
    return patch2;
  }

  const keys = Object.keys(patch2);
  const length = keys.length;
  for (let i = 0; i < length; i++) {
    const key = keys[i];
    if (_isObject(patch2[key])) {
      patch1[key] = aggregate(
        _isObject(patch1[key]) ? patch1[key] : createByType(patch2[key]),
        patch2[key]
      );
    } else {
      patch1[key] = patch2[key];
    }
  }

  return patch1;
}

function index(key: string, levelDiffs: { arrayOffset?: number }): number {
  return Number(key) + (levelDiffs.arrayOffset || 0);
}

function getAll(current: PatchDiff, partsAndKeys: string[], parentParams: Record<string, any> = {}): GetAllResult[] {
  const pathPart = partsAndKeys.shift();
  const keyName = partsAndKeys.shift();
  current = current.at(pathPart || '');
  const value = current.get();
  
  if (value === undefined) {
    return [{ params: parentParams, value: undefined, isPattern: true }];
  }
  
  if (keyName) {
    if (typeof value !== 'object') {
      return [{ params: parentParams, value: undefined, isPattern: true }];
    }

    const multi: GetAllResult[] = [];
    Object.keys(value).forEach((key) => {
      const params = { ...parentParams, [keyName]: key };
      if (partsAndKeys.length) {
        getAll(current.at(key), [...partsAndKeys], params).forEach((v) => {
          multi.push(v);
        });
      } else {
        multi.push({ value: current.get(key), params });
      }
    });

    return multi;
  }
  
  return [{ value, params: parentParams, isPattern: true }];
}

function createPathMatcher(pattern: string): (path: string) => Record<string, string> | null {
  const regex = /:([\w]+)/g;
  const keys: string[] = [];
  const replaced = '^' + pattern
    .replace(regex, (match, capture) => {
      keys.push(capture);
      return `:(\\w+)`;
    })
    .replace(/\[/g, '\\[?')
    .replace(/\]/g, '\\]?')
    .replace(/\:/g, '\\.?')
    .replace(/\./g, '\\.')
    .replace('**', '([\\w\\.]+)')
    .replace('*', '(\\w+)')
    + '$';

  const regexp = new RegExp(replaced);

  return function match(path: string): Record<string, string> | null {
    const matches = path.match(regexp);
    if (!matches) {
      return null;
    }

    const params: Record<string, string> = {};
    keys.forEach((key, index) => {
      params[key] = matches[index + 1];
    });

    return params;
  };
}

export const DeleteKeyword = '__$$D';
export const SpliceKeyword = '__$$S';
export const UndefinedKeyword = '__$$U';
export const ProtoKeyword = '__$$P';

export class PatchDiff<T = any> extends EventEmitter implements IPatchDiff<T> {
  private options: Required<PatchDiffOptions>;
  private proxies: WeakMap<object, any>;
  private _data: T;
  private _whitelist?: Set<string>;
  private _path?: string;
  private _wrapper?: Record<string, any>;
  private _wrapperInner?: Record<string, any>;
  private _wrapperKey?: string;
  private _root?: PatchDiff<T>;

  setMaxListeners!: (n: number) => void;

  constructor(object?: T, options?: PatchDiffOptions) {
    super();

    this.options = {
      emitEvents: true,
      undefinedKeyword: UndefinedKeyword,
      deleteKeyword: DeleteKeyword,
      spliceKeyword: SpliceKeyword,
      protoKeyword: ProtoKeyword,
      fireGlobalChangeEvents: false,
      maxKeysInLevel: 10000,
      maxLevels: 60,
      maxListeners: 1000000,
      disableSplices: true,
      overrides: [],
      context: undefined,
      defer: false,
      ...options
    };

    this.proxies = new WeakMap();
    this._data = object || {} as T;
    this.setMaxListeners(this.options.maxListeners);
  }

  apply(patch: Partial<T>, path?: string, options?: MergeOptions): Partial<T> {
    // Implementation needed
    return patch;
  }

  patch(patch: Partial<T>, path?: string, options?: MergeOptions): Partial<T> {
    return this.apply(patch, path, options);
  }

  merge(patch: Partial<T>, path?: string, options?: MergeOptions): Partial<T> {
    return this.apply(patch, path, options);
  }

  set<K extends keyof T>(value: T[K], path?: K, options?: MutationOptions): Partial<T> {
    if (!path) return value as unknown as Partial<T>;
    return { [path as string]: value } as unknown as Partial<T>;
  }

  displace<K extends keyof T>(value: T[K], path?: K, options?: MutationOptions): void {
    this.set(value, path, { ...options, changeType: 'displace' });
  }

  override<K extends keyof T>(value: T[K], path?: K, options?: MutationOptions): Partial<T> {
    return this.set(value, path, { ...options, overrides: true });
  }

  remove(path?: string, options?: MutationOptions): Partial<T> {
    const patch = path ? { [path]: this.options.deleteKeyword } : this.options.deleteKeyword;
    return this.apply(patch as Partial<T>, undefined, options);
  }

  splice(spliceParams: SpliceParams, path?: string, options?: MutationOptions): Partial<T> {
    const patch = path 
      ? { [path]: { [this.options.spliceKeyword]: spliceParams } }
      : { [this.options.spliceKeyword]: spliceParams };
    return this.apply(patch as Partial<T>, undefined, options);
  }

  get<K extends keyof T>(path?: K): T[K] {
    if (!path) return this._data as T[K];
    return (this._data as any)[path as string];
  }

  getAll(pathPattern: string): Array<GetAllResult> {
    // Implementation needed
    return [];
  }

  getClone<K extends keyof T>(path?: K): T[K] {
    const value = this.get(path);
    return _isObject(value) ? { ...value } as T[K] : value;
  }

  subscribe(pathOrCallback: string | SubscribeCallback<T>, callbackOrSkipInitial?: SubscribeCallback<T> | boolean, skipInitial?: boolean): UnsubscribeCallback {
    if (typeof pathOrCallback === 'string') {
      const callback = callbackOrSkipInitial as SubscribeCallback<T>;
      // Implementation for path-based subscription
      return () => {};
    } else {
      const callback = pathOrCallback;
      const skipInit = callbackOrSkipInitial as boolean;
      // Implementation for callback-only subscription
      return () => {};
    }
  }

  at(subPath: string): PatchDiff<T> {
    const newPatchDiff = new PatchDiff<T>(undefined, this.options);
    newPatchDiff._path = subPath;
    newPatchDiff._root = this._root || this;
    return newPatchDiff;
  }

  scope(subPath: string): IPatchDiff<T> {
    return this.at(subPath);
  }

  whitelist(keys: KeyList): void {
    this._whitelist = new Set(keys);
  }

  getWhenExists<K extends keyof T>(path?: K): Promise<T[K]> {
    return new Promise((resolve) => {
      const value = this.get(path);
      if (value !== undefined) {
        resolve(value);
        return;
      }

      const unsubscribe = this.subscribe((patch) => {
        const value = path ? (patch as any)[path as string] : patch;
        if (value !== undefined) {
          unsubscribe();
          resolve(value as T[K]);
        }
      });
    });
  }

  whenAnything<K extends keyof T>(path?: K): Promise<T[K]> {
    return new Promise((resolve) => {
      const unsubscribe = this.subscribe((patch) => {
        const value = path ? (patch as any)[path as string] : patch;
        unsubscribe();
        resolve(value as T[K]);
      });
    });
  }

  getFullPath(subPath?: string): string {
    return subPath ? concatPath(this._path || '', subPath) : (this._path || '');
  }

  getData(proxyOptions?: Partial<ProxyOptions>): T {
    return this._data;
  }

  get data(): T {
    return this._data;
  }

  get root(): PatchDiff<T> {
    return this._root || this;
  }
}

export default PatchDiff; 