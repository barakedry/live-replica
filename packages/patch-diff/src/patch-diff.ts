import { EventEmitter, PATH_EVENT_PREFIX } from '../../events/events';
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
} from '../../utils/utils';
import { DiffTracker } from './diff-tracker';
import { create, isProxy, revoke, unwrap } from '../../proxy'

import _isObject from 'lodash-es/isObject';
import _isString from 'lodash-es/isString';
import _isEqual from 'lodash-es/isEqual';
import _get from 'lodash-es/get';
import _keys from 'lodash-es/keys';
import _isArray from 'lodash-es/isArray';
import _isUndefined from 'lodash-es/isUndefined';

const logError = (msg: string) => { console.error('LiveReplica PatchDiff: ' + msg); };

const eventsWithoutPrepend = new Set(['destroyed', 'error', '_subscribed', '_synced']);

const _isFunction = (obj: unknown): obj is Function => typeof obj === 'function';

function createByType(obj: unknown): object {
  if (_isArray(obj)) {
    return [];
  }
  return {};
}

function aggregate<T = any>(patch1: any, patch2: any): any {
  if (!patch1) {
    return patch2;
  }
  const keys = Object.keys(patch2);
  const length = keys.length;
  for (let i = 0; i < length; i++) {
    const key = keys[i];
    if (_isObject(patch2[key])) {
      patch1[key] = aggregate(_isObject(patch1[key]) ? patch1[key] : createByType(patch2[key]), patch2[key]);
    } else {
      patch1[key] = patch2[key];
    }
  }
  return patch1;
}

function index(key: string | number, levelDiffs: any): number {
  return Number(key) + (levelDiffs.arrayOffset || 0);
}

type PartsAndKeys = Array<string>;

type GetAllResult<T> = { params: Record<string, string>; value: T | undefined; isPattern: boolean };

function getAll<T = any>(current: PatchDiff<T>, partsAndKeys: PartsAndKeys, parentParams: Record<string, string> = {}): GetAllResult<T>[] {
  const pathPart = partsAndKeys.shift();
  const keyName = partsAndKeys.shift();
  current = current.at(pathPart!) as PatchDiff<T>;
  const value = current.get();
  if (value === undefined) {
    return [{ params: parentParams, value: undefined, isPattern: true }];
  } else {
    if (keyName) {
      if (typeof value !== 'object') {
        return [{ params: parentParams, value: undefined, isPattern: true }];
      }
      let multi: GetAllResult<T>[] = [];
      Object.keys(value).forEach((key) => {
        const params = { ...parentParams, [keyName]: key };
        if (partsAndKeys.length) {
          getAll(current.at(key) as PatchDiff<T>, [...partsAndKeys], params).forEach((v) => {
            multi.push(v);
          });
        } else {
          multi.push({ value: current.get(key), params, isPattern: true });
        }
      });
      return multi;
    } else {
      return [{ value, params: parentParams, isPattern: true }];
    }
  }
}

type PathMatcher = (path: string) => Record<string, string> | null;

function createPathMatcher(pattern: string): PathMatcher {
  // Escape special regex characters in the pattern
  const regex = /:([\w]+)/g;
  const keys: string[] = [];
  const replaced = '^' + pattern.replace(regex, (match: string, capture: string) => {
    keys.push(capture);
    return `:(\\w+)`;
  })
    .replace(/\[/g, '\\[?')
    .replace(/\]/g, '\\]?')
    .replace(/\:/g, '\.?')
    .replace(/\./g, '\\.')
    .replace('**', '([\\w\\.]+)')
    .replace('*', '(\\w+)')
    + '$';
  const regexp = new RegExp(replaced);
  return function match(path: string) {
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

// Native types for patch-diff (migrated from @types/index.d.ts)
export type KeyList = string[] | Set<string>;

export type DiffInfo<T = any> = {
    snapshot?: boolean;
    hasAdditions?: boolean;
    hasAddedObjects?: boolean;
    hasDeletions?: boolean;
    hasUpdates?: boolean;
    hasDifferences?: boolean;
    additions?: T extends Array<any> ? Array<T[number]> : Partial<T>;
    deletions?: Partial<T>;
    updates?: Partial<T>;
    addedObjects?: Partial<T>;
    differences?: T extends Array<any> ? Array<T[number]> : Partial<T>;
    changeType?: 'displace' | 'change' | '';
};

export type SubscribeCallback<T = any> = (
    patchOrSnapshot?: Partial<T>,
    changeInfo?: DiffInfo<T>,
    context?: any,
    deferred?: boolean,
    params?: Record<string, any>
) => void;

export type UnsubscribeCallback = () => void;

export type SpliceParams = { index: number; itemsToRemove: number; itemsToAdd?: any[] };

export type MutationOptions = {
    defer?: boolean;
    context?: any;
    [key: string]: any;
};

export type MergeOptions = MutationOptions & {
    overrides?: Record<string, true> | string[];
};

export type ApplyOptions = {
    emitEvents?: boolean;
    maxKeysInLevel?: number;
    maxLevels?: number;
    maxListeners?: number;
};

export type ProxyOptions = { readonly: boolean };

export class PatchDiff<T = any> extends EventEmitter {
  public options: Required<ApplyOptions> & {
    undefinedKeyword: string;
    deleteKeyword: string;
    spliceKeyword: string;
    protoKeyword: string;
    fireGlobalChangeEvents: boolean;
    maxKeysInLevel: number;
    maxLevels: number;
    maxListeners: number;
    disableSplices: boolean;
    [key: string]: any;
  };
  public proxies: WeakMap<object, any>;
  public _data: T;
  public _whitelist?: Set<string>;
  public _path?: string;
  public _root?: PatchDiff<T>;
  public _wrapper?: any;
  public _wrapperInner?: any;
  public _wrapperKey?: string;
  public _subs?: any;
  public _listenedPaths: string[];

  constructor(object?: T, options?: Partial<ApplyOptions> & { [key: string]: any }) {
    super();
    this._listenedPaths = [];
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
      ...options
    };
    this.proxies = new WeakMap();
    this._data = object || ({} as T);
    this.setMaxListeners(this.options.maxListeners);
  }

  apply(patch: any, path?: string, options?: ApplyOptions) {

    //path = concatPath(this._path, path);
    options = {
      ...this.options,
      ...options,
    }

    if (!_isObject(patch) && !path && !this._path) {
      logError('invalid apply, target and patch must be objects');

      return;
    }


    if (isProxy(patch)) {
      patch = unwrap(patch);
    }

    if (this._whitelist) {
      if (path) {
        if (!this._whitelist.has(firstKey(path))) {
          return;
        }
      } else {
        // @ts-expect-error
        patch = pickWithKeys(patch, this._whitelist, false);
      }
    }

    let wrappedPatch = wrapByPath(patch, path!);
    if (this._wrapper) {
      // @ts-expect-error
      this._wrapperInner[this._wrapperKey] = wrappedPatch
      wrappedPatch = this._wrapper;
    }

    // adjustOverrides - allows to override/set specific paths in the patch
    // @ts-expect-error
    if (options.overrides) {
      options = { ...options };
      const overrides: Record<string, true> = {};
      // @ts-expect-error
      if (Array.isArray(options.overrides)) {
        // @ts-expect-error
        options.overrides.forEach((path) => {
          overrides[concatPath(this._path!, path)!] = true;
        });
      } else {
        throw new Error('LiveReplica PatchDiff: invalid overrides must be an array of paths');
      }

      // @ts-expect-error
      options.overrides = overrides;
    }

    // @ts-expect-error
    this._applyObject(this._data, wrappedPatch, '', options, 0);

    if (this._wrapper) {
      // @ts-expect-error
      delete this._wrapperInner[this._wrapperKey];
    }
  }

  displace(value: any, path?: string, options?: MutationOptions) {
    if (this._whitelist) {
      throw new Error('LiveReplica PatchDiff: set is not supported with whitelist');
    }

    options = {
      ...this.options,
      ...options,
    };

    // @ts-expect-error
    const fullPath = concatPath(this._path, path);

    if (fullPath && (!_isString(fullPath))) {
      logError('cannot displace, invalid path');
      return;
    }

    const rootPatcher = (this._root || this);

    const safeFullPath = fullPath || '';
    const affectedPaths: string[] = this._listenedPaths.filter(p => p.startsWith(safeFullPath) || safeFullPath.startsWith(p));

    const currentValuesByPath: { [key: string]: any } = {};
    affectedPaths.forEach((path) => {
      // if affected by this change
      const data = rootPatcher.get(path, undefined);
      currentValuesByPath[path] = data;
    });

    // set the root data
    if (!fullPath) {
      this._data = structuredClone(value);
    } else {
      const { path: parenPath, key } = splitPathAndLastKey(fullPath);

      const parent = rootPatcher.get(parenPath, undefined);
      if (!parent) {
        rootPatcher.displace({ [key]: value }, parenPath); // this will create the parent object
        return;
      }

      if (value === this.options.deleteKeyword) {
        delete rootPatcher.get(parenPath)[key];
      } else {
        rootPatcher.get(parenPath)[key] = structuredClone(value);
      }

    }


    affectedPaths.forEach((path) => {
      // if affected by this change
      const data = rootPatcher.get(path, undefined);
      if (data !== currentValuesByPath[path]) {
        this.emit(PATH_EVENT_PREFIX + path, { differences: data, hasDifferences: true, changeType: 'displace' }, options);
      }
    });

    //this.emit(PATH_EVENT_PREFIX, {differences: this._data, hasDifferences: true, changeType: 'displace'}, options);

    let differences = rootPatcher.get(fullPath);
    let currPath = fullPath;
    this.emit(PATH_EVENT_PREFIX + currPath, { differences, hasDifferences: true, changeType: 'displace' }, options);

    if (currPath) {
      // bubble up the change

      let split = splitPathAndLastKey(currPath);
      while (split.path || split.key) {
        differences = { [split.key]: differences };
        this.emit(PATH_EVENT_PREFIX + split.path, { differences, hasDifferences: true }, options);
        currPath = split.path;
        split = splitPathAndLastKey(currPath);
      }
    }
  }


  set(fullDocument?: any, path?: string, options?: MutationOptions) {

    options = {
      ...this.options,
      ...options,
    };

    if (!_isObject(fullDocument) && !path && !this._path) {
      logError('invalid set, fullDocument must be an object');
      return;
    }

    if (this._whitelist) {
      throw new Error('LiveReplica PatchDiff: set is not supported with whitelist');
    }

    if (isProxy(fullDocument)) {
      fullDocument = unwrap(fullDocument);
    }

    let wrapped = wrapByPath(fullDocument, path!);

    if (this._wrapper) {
      // @ts-expect-error
      this._wrapperInner[this._wrapperKey] = wrapped
      wrapped = this._wrapper;
    }


    this._applyObject(this._data, wrapped, '', options, 0, concatPath(this._path || '', path || '') || true);

    if (this._wrapper) {
      // @ts-expect-error
      delete this._wrapperInner[this._wrapperKey];
    }

  }

  remove(path?: string, options?: MutationOptions) {

    options = {
      ...this.options,
      ...options,
      deletePatch: true
    };


    if (!path && !this._path) {
      this.destroyProxy();
      // @ts-expect-error
      this._data = Array.isArray(this._data) ? [] : {};
      return;
    }

    if (path && this._whitelist && !this._whitelist.has(firstKey(path))) {
      return;
    }

    let wrapped = wrapByPath(DeleteKeyword, path!);
    if (this._wrapper) {
      // @ts-expect-error
      this._wrapperInner[this._wrapperKey] = wrapped
      wrapped = this._wrapper;
    }


    // @ts-expect-error
    this._applyObject(this._data, wrapped, '', options, 0);

    if (this._wrapper) {
      // @ts-expect-error
      delete this._wrapperInner[this._wrapperKey];
    }

  }

  splice({ index, itemsToRemove, itemsToAdd }: {
    index: number;
    itemsToRemove: number;
    itemsToAdd?: any[];
  }, path?: string, options?: MutationOptions) {
    options = {
      ...this.options,
      ...options,
    };

    // @ts-expect-error
    path = concatPath(this._path, path);
    // @ts-expect-error
    this._applyObject(this._data, wrapByPath({ [SpliceKeyword]: { index, itemsToRemove, itemsToAdd } }, path), '', options, 0);
  }

  // @ts-expect-error
  getFullPath(path) {
    // @ts-expect-error
    return concatPath(this._path, path);
  }

  // @ts-expect-error
  getAll(pathPattern) {

    const isPattern = pathPattern && (pathPattern.includes('*') || pathPattern.includes(':'));
    if (!isPattern) {
      return [{ value: this.get(pathPattern, undefined), params: {}, isPattern: false }];
    }

    let unnamedKeys = [];
    // @ts-expect-error
    pathPattern = pathPattern.replaceAll("*", (match) => {
      const keyName = `$key_${unnamedKeys.length}`;
      unnamedKeys.push(keyName);
      return `[:${keyName}]`;
    });

    // @ts-expect-error
    const partsAndKeys = pathPattern.split(/\[:+|\]\./).map((item, index) => { return index > 0 ? item.split(']')[0] : item });

    return (getAll(this, partsAndKeys, {}) || []).filter(v => !!v);
  }

  get(path?: string, callback?: (value: any) => void) {

    if (typeof path === 'function') {
      callback = path;
      path = undefined;
    }

    const fullPath = concatPath(this._path || '', path || '');
    if (fullPath && (!_isString(fullPath))) {
      logError('invalid path, cannot get');

      return;
    }

    let retVal;
    if (fullPath) {
      retVal = _get(this._data, fullPath);
    } else {
      retVal = this._data;
    }

    if (this._whitelist) {
      if (path) {
        if (!this._whitelist.has(firstKey(path))) {
          return undefined;
        }
      } else if (retVal) {
        // @ts-expect-error
        retVal = pickWithKeys(retVal, this._whitelist);
      }
    }


    if (callback) {
      if (retVal) {
        callback(retVal);
      } else {
        // subscribe for first data
        let unsub: any;
        let once: any;
        const parent = parentPath(path!);
        unsub = this.subscribe(parent || '', (data: any) => {
          if (!once) {
            const value = _get(this._data, fullPath as string);
            if (value !== undefined) {
              callback(value);
              once = true;
              setTimeout(unsub, 0);
            }
          }
        });
      }
    }

    return retVal;
  }

  getClone(path?: string) {
    let obj = this.get(path, undefined);
    if (obj) {
      if (this._whitelist) {
        obj = pickWithKeys(obj, Array.from(this._whitelist));
      }

      return structuredClone(obj);
    }
    return undefined;
  }

  on(event: string, fn: any, prependPath = true) {
    const result = super.on(event, fn);
    // Track only path events (not patterns, not empty)
    if (typeof event === 'string' && event.startsWith(PATH_EVENT_PREFIX)) {
      const path = event.substring(PATH_EVENT_PREFIX.length);
      if (path && !this._listenedPaths.includes(path)) {
        this._listenedPaths.push(path);
      }
    }
    return result;
  }

  off(event: string, fn: any) {
    super.off(event, fn);
    // Remove from _listenedPaths if no more listeners for this path
    if (typeof event === 'string' && event.startsWith(PATH_EVENT_PREFIX)) {
      const path = event.substring(PATH_EVENT_PREFIX.length);
      if (path) {
        const count = this.listenerCount(event);
        if (count === 0) {
          this._listenedPaths = this._listenedPaths.filter(p => p !== path);
        }
      }
    }
  }

  // @ts-expect-error
  whitelist(keySet) {

    if (Array.isArray(keySet)) {
      keySet = new Set(keySet);
    }

    let addedKeys: any[] = [];
    let removedKeys: any[] = [];
    const existingKeys = this._whitelist || new Set();

    if (this._whitelist) {
      addedKeys = Array.from(keySet).filter(key => !this._whitelist!.has(key as string));
      removedKeys = Array.from(this._whitelist!).filter(key => !(keySet as Set<string>).has(key as string));
    }

    // create a temp union to be able to update changes for all keys
    this._whitelist = new Set([...existingKeys, ...keySet]);

    if (addedKeys.length || removedKeys.length) {
      // synthesis diff based on added and removed keys
      const differences = {};
      const deletions = {};
      const additions = {};
      let hasAdditions = false;
      let hasDeletions = false;


      removedKeys.forEach(key => {
        hasDeletions = true;
        (deletions as any)[key] = this.get(key, undefined);
        (differences as any)[key] = DeleteKeyword;
      });

      addedKeys.forEach(key => {
        const val = this.get(key, undefined);
        if (val !== undefined) {
          (differences as any)[key] = val;
          (additions as any)[key] = val;
          hasAdditions = true;
        }
      });


      let path = this._path || '';
      path = path || '';
      path = fixNumericParts(path || '');
      this.emit(PATH_EVENT_PREFIX + path, { differences, hasDifferences: true, hasDeletions, hasAdditions, deletions, additions, changeType: 'whitelist-change' }, {});
      if (this.options.fireGlobalChangeEvents) {
        this.emit('change', { differences, hasDifferences: true, hasDeletions, hasAdditions, deletions, additions, changeType: 'whitelist-change' }, path, {});
      }
    }

    this._whitelist = keySet;
  }


  subscribe(subPath: string, fn?: SubscribeCallback, skipInitial = false) {
    if (typeof subPath === 'function') {
      skipInitial = !!fn;
      fn = subPath;
      subPath = '';
    }

    const cb = fn;
    let aggregatedPatch: any;
    let aggregatedChangesInfo: any;
    let lastOptions: any;
    let lastTimeout: any;

    const flush = () => {
      if (!aggregatedPatch) { return; }
      cb?.(aggregatedPatch, aggregatedChangesInfo, lastOptions?.context || {}, true, lastOptions?.params);
      aggregatedPatch = undefined;
      aggregatedChangesInfo = undefined;
      lastOptions = undefined;
      lastTimeout = undefined;
    };

    fn = (patch: any, changesInfo: any, options: any) => {
      clearTimeout(lastTimeout);
      const flushNow = options.defer !== true ||
        typeof patch !== 'object' ||
        changesInfo.snapshot ||
        (lastOptions?.type && lastOptions.type !== options.type) ||
        (lastOptions?.context && !_isEqual(lastOptions.context, options.context));
      if (flushNow) {
        if (aggregatedPatch) {
          flush();
        }
        cb?.(patch, changesInfo, options.context || {}, false, options.params);
        return;
      }
      lastOptions = options;
      aggregatedPatch = aggregatedPatch ? aggregate(aggregatedPatch, patch) : patch;
      aggregatedChangesInfo = aggregatedChangesInfo ? aggregate(aggregatedChangesInfo, changesInfo) : changesInfo;
      lastTimeout = setTimeout(flush, 0);
    };

    const isPattern = subPath.includes('*') || subPath.includes(':');

    if (!skipInitial) {
      if (isPattern) {
        this.getAll(subPath).forEach(({ value, params }) => {
          fn(value, { snapshot: true }, { ...this.options, params });
        });
      } else {
        fn(this.get(subPath, undefined), { snapshot: true }, this.options);
      }
    }

    let path = concatPath(this._path || '', subPath || '');
    path = path || '';
    path = fixNumericParts(path || '');

    let handler = (diff: any, options: any) => {
      fn(diff.differences, diff, options);
    };

    if (this._whitelist) {
      handler = (diff: any, options: any) => {
        const delta = pickWithKeys(diff.differences, Array.from(this._whitelist!));
        if (delta) {
          fn(delta, diff, options);
        }
      };
    }

    let changeHandler: any;
    if (isPattern) {
      (this._root || this).options.fireGlobalChangeEvents = true;

      const match = createPathMatcher(path);

      changeHandler = (diff: any, path: any, options: any) => {
        const matchedParams = match(path);
        if (matchedParams) {
          handler(diff, {
            options,
            path,
            params: matchedParams
          });
        }
      };

      super.on('change', changeHandler);
    } else {
      super.on(PATH_EVENT_PREFIX + path, handler);
    }

    return () => {
      clearTimeout(lastTimeout);
      if (!handler) { return; }
      this.removeListener(PATH_EVENT_PREFIX + path, handler);
      if (changeHandler) {
        this.removeListener('change', changeHandler);
      }
      handler = (() => {}) as any;
    };
  }

  // @ts-expect-error
  getWhenExists(path) {
    return new Promise(resolve => {
      this.get(path, resolve);
    });
  }

  // @ts-expect-error
  whenAnything(path) {
    return new Promise(resolve => {
      const unsub = this.subscribe(path, (data: any) => {
        if (typeof data === 'object' && Object.keys(data).length !== 0) {
          resolve(data);
          setTimeout(() => unsub(), 0);
        }
      });
    });
  }


  at(subPath: string) {

    let path = concatPath(this._path || '', subPath || '');

    if (this._whitelist) {
      let allowed = false;
      this._whitelist.forEach(key => {
        if (key === subPath || subPath.startsWith(key + '.')) {
          allowed = true;
        }
      });

      if (!allowed) {
        throw new Error(`at(): path "${subPath}" is not allowed by whitelist`);
      }
    }

    const at = Object.create(this);
    at._root = this.root;
    at._whitelist = null;
    at._subs = {};
    at._path = fixNumericParts(path || '');

    const { wrapper, wrapperInner, lastKey } = createWrapperWithLastKey(path || '');

    at._wrapper = wrapper;
    at._wrapperInner = wrapperInner;
    at._wrapperKey = lastKey;

    return at;
  }

  parent() {

    const root = this._root;

    if (root === this) {
      return undefined;
    }

    const { path: parentPathVal, key } = splitPathAndLastKey(this._path || '');
    const parent = (root! as any).at(parentPathVal).get();

    return parent;
  }

  // @ts-expect-error
  get root() { return this._root || this; }

  /************************************************************************************
   * The basic merging recursion implementation:
   * ._applyObject() -> ._applyAtKey() -> ._applyObject() -> ._applyAtKey() -> ...
   *
   * ._applyObject() iterate keys at level and calls ._applyAtKey() for each key,
   * after iteration ends it emits and returns level changes to the caller.
   *
   * ._applyAtKey() assigns/remove primitives and calls _.applyObject() for objects
   ************************************************************************************/
  // @ts-expect-error
  _applyObject(target, patch, path, options, level, override) {

    if (!(_isObject(target) && _isObject(patch))) {
      logError('invalid apply, target and patch must be objects');
      this.emit('error', new Error('invalid apply, target and patch must be objects'));

      return {};
    }

    if (level > options.maxLevels) {
      const errorMsg = `Stopped patching, Too many levels - ${level} out of ${options.maxLevels} allowed levels to path "${path}"`;
      logError(errorMsg);
      this.emit('error', new Error(errorMsg));

      return {};
    }

    let levelDiffs;
    let keys = _keys(patch);
    let length = keys.length;
    let isTargetArray = _isArray(target);

    if (options.emitEvents) {
      levelDiffs = DiffTracker.create(isTargetArray && (target as any).length === 0 && _isArray(patch), options.deletePatch);
      (levelDiffs as any).path = path;
    }

    if (isTargetArray) {
      levelDiffs = levelDiffs || {};
    }

    if (length > options.maxKeysInLevel) {
      const errorMsg = `Stopped patching, Too many keys in object - ${length} out of ${options.maxKeysInLevel} allowed keys to path "${path}"`;
      logError(errorMsg);
      this.emit('error', new Error(errorMsg));
      return levelDiffs;
    }

    // main logic loop, iterate patch keys and apply to dest object
    for (let i = 0; i < length; i++) {
      const key = keys[i];
      const patchVal = (patch as any)[key];

      if (patchVal !== (target as any)[key] && patchVal === patchVal) {
        levelDiffs = this._applyAtKey(target, patch, path, key, levelDiffs, options, level, override, isTargetArray);
      }
    }

    // override is either undefined, a path or true
    if ((!_isUndefined(override) && (override === true || path.indexOf(override) === 0)) || (options.overrides && (options.overrides[path]))) {
      levelDiffs = this._detectDeletionsAtLevel(target, patch, levelDiffs, path, options, isTargetArray);
    }

    if (options.emitEvents && levelDiffs.hasDifferences) {
      this.emit(PATH_EVENT_PREFIX + (path || ''), levelDiffs, options);
      if (options.fireGlobalChangeEvents) {
        this.emit('change', levelDiffs, path, options);
      }
    }

    return levelDiffs;
  }

  // @ts-expect-error
  _applyAtKey(target, patch, path, key, levelDiffs, options, level, override, isTargetArray) {

    let childDiffs,
      patchValue,
      existingValue,
      srcKey,
      appliedValue, // this value is what goes out to the tracker its not always the same as patchValue
      isExistingValueArray,
      isPatchValueObject = false;

    patchValue = (patch as any)[key];
    srcKey = key;

    // splice treat as primitive
    if (key === SpliceKeyword) {
      appliedValue = this._splice(path, patchValue.index, patchValue.itemsToRemove || 0, ...(patchValue.itemsToAdd || []));
      (target as any)[srcKey] = patchValue;
      levelDiffs.hasUpdates = true;
      levelDiffs.hasDifferences = true;
      levelDiffs.differences[key] = appliedValue;

      return levelDiffs;
    }

    if (_isFunction(patchValue)) {
      appliedValue = SERIALIZED_FUNCTION;
    } else {
      isPatchValueObject = _isObject(patchValue);
      if (_isUndefined(patchValue)) {
        appliedValue = UndefinedKeyword;
      } else if (patchValue === UndefinedKeyword) {
        appliedValue = patchValue;
        patchValue = undefined;
      } else {
        appliedValue = patchValue;
      }
    }

    if (isTargetArray) {
      srcKey = index(srcKey, levelDiffs);
    }

    // new
    if (!target.hasOwnProperty(srcKey)) {
      if (patch[key] !== DeleteKeyword && !options.deletePatch) {

        levelDiffs.hasAdditions = true;
        levelDiffs.hasDifferences = true;


        // add new object
        if (isPatchValueObject) {

          (target as any)[srcKey] = patchValue.constructor.call(Object.create(Object.getPrototypeOf(patchValue)));

          childDiffs = this._applyObject(
            (target as any)[srcKey],
            patchValue,
            pushKeyToPath(path, key, isTargetArray),
            options,
            level + 1,
            override,
            // @ts-expect-error
            isTargetArray
          );


          levelDiffs.addChildTracking(childDiffs, key, true);

          // empty object
          if (!childDiffs.hasAdditions) {
            levelDiffs.additions[key] = appliedValue;
            levelDiffs.differences[key] = appliedValue;
          }

          // add new primitive
        } else {
          (target as any)[srcKey] = patchValue;
          levelDiffs.additions[key] = appliedValue;
          levelDiffs.differences[key] = appliedValue;
          const leafPath = pushKeyToPath(path, srcKey, isTargetArray);
          this.emit(PATH_EVENT_PREFIX + (leafPath || ''), { differences: appliedValue, additions: appliedValue }, options);
          if (options.fireGlobalChangeEvents) {
            this.emit('change', { differences: appliedValue, additions: appliedValue }, leafPath, options);
          }
        }
      }
      // existing
    } else {

      existingValue = (target as any)[srcKey];
      isExistingValueArray = _isArray(existingValue);

      // remove
      if (patch[key] === DeleteKeyword) {
        levelDiffs = this._deleteAtKey(target, path, key, options, existingValue, levelDiffs, isTargetArray);

        // update object
      } else if (isPatchValueObject) {

        // we should replace the target value, todo: array merges check is not sufficient
        if (!isExistingValueArray && !hasSamePrototype(existingValue, patchValue)) {

          // this is a restructure
          // handle prototypes
          (target as any)[srcKey] = Object.create(this._getPrototypeOf(patchValue));

        }

        childDiffs = this._applyObject(
          (target as any)[srcKey],
          patchValue,
          pushKeyToPath(path, key, isTargetArray),
          options,
          level + 1,
          override
        );

        levelDiffs.addChildTracking(childDiffs, key);

        // update primitive
      } else {

        (target as any)[srcKey] = patchValue;

        const updates = {
          oldVal: existingValue,
          newVal: appliedValue
        };

        levelDiffs.hasUpdates = true;
        levelDiffs.hasDifferences = true;
        levelDiffs.updates[key] = updates;
        levelDiffs.differences[key] = appliedValue;
        const leafPath = pushKeyToPath(path, srcKey, isTargetArray);
        //this.emit(PATH_EVENT_PREFIX + (leafPath || ''),  {differences: appliedValue}, {...options, type: 'update', oldValue: existingValue});
        this.emit(PATH_EVENT_PREFIX + (leafPath || ''), { differences: appliedValue, updates }, options);
        if (options.fireGlobalChangeEvents) {
          this.emit('change', { differences: appliedValue, updates }, leafPath, options);
        }
      }

    }

    return levelDiffs;
  }

  // @ts-expect-error
  _deleteAtKey(target, path, key, options, existingValue, levelDiffs, isArray) {
    if (isArray) {
      target.splice(index(key, levelDiffs), 1);
      levelDiffs.arrayOffset = (levelDiffs.arrayOffset || 0) - 1;
    } else {
      delete target[key];
    }

    if (existingValue === undefined) {
      return levelDiffs;
    }

    levelDiffs.deletions[key] = existingValue;
    levelDiffs.differences[key] = DeleteKeyword;
    levelDiffs.hasDeletions = true;
    levelDiffs.hasDifferences = true;

    if (_isObject(existingValue) && !options.skipInnerDeletionEvents) {
      //levelDiffs.addChildTracking(this._emitInnerDeletions(path, existingValue, options), key)
      const childDiffs = this._emitInnerDeletions(pushKeyToPath(path, key, isArray), existingValue, options);
      levelDiffs.addChildTracking(childDiffs, key);
    }

    const eventPath = pushKeyToPath(path, key) || '';
    this.emit(PATH_EVENT_PREFIX + eventPath, {
      differences: DeleteKeyword,
      deletions: existingValue,
      hasDeletions: true,
      hasDifferences: true,
      hasUpdates: false,
      hasAdditions: false,
      hasAddedObjects: false
    }, options);

    if (options.fireGlobalChangeEvents) {
      this.emit('change', {
        differences: DeleteKeyword,
        deletions: existingValue,
        hasDeletions: true,
        hasDifferences: true,
        hasUpdates: false,
        hasAdditions: false,
        hasAddedObjects: false
      }, eventPath, options);
    }

    if (_isObject(existingValue)) {
      revoke(existingValue);
    }

    return levelDiffs;
  }

  // @ts-expect-error
  _detectDeletionsAtLevel(target, patch, levelDiffs, path, options, isTargetArray) {
    const keys = _keys(target),
      length = keys.length;

    let existingValue,
      key,
      i;

    // run target object at this level
    for (i = 0; i < length; i++) {
      key = keys[i];

      if (patch[key] === undefined) {
        existingValue = target[key];
        this._deleteAtKey(target, path, key, options, existingValue, levelDiffs, isTargetArray);
      }
      else if (typeof patch[key] === 'object') {
        const diffs = DiffTracker.create(_isArray(target[key]) && target[key].length === 0 && _isArray(patch[key]), options.deletePatch);
        this._detectDeletionsAtLevel(target[key], patch[key], diffs, pushKeyToPath(path, key, isTargetArray), options, Array.isArray(target[key]));
        levelDiffs.addChildTracking(diffs, key);
      }

    }

    return levelDiffs;
  }

  _splice(path: string, index: number, itemsToRemove: number, ...itemsToAdd: any[]) {
    const target = this.get(path, undefined);
    if (!_isArray(target)) {
      logError('invalid splice, target must be an array');

      return { deleted: [] };
    }
    const deleted = target.splice(index, itemsToRemove, ...itemsToAdd);
    const diff = { index, itemsToRemove, itemsToAdd, deleted };

    return diff;
  }

  // @ts-expect-error
  _getPrototypeOf(object) {
    return Object.getPrototypeOf(object);
  }

  // @ts-expect-error
  _emitInnerDeletions(path, deletedObject, options) {
    let levelDiffs,
      childDiffs;

    if (!_isObject(deletedObject)) {
      return;
    }

    levelDiffs = DiffTracker.create(false, options.deletePatch);
    (levelDiffs as any).path = path;
    /*
            // this is often faster than scanning down recursively and emitting events
            const affectedSubscriberPaths = this.listenedPaths.filter(p => p.startsWith(path));
            affectedSubscriberPaths.forEach(p => {
                const subPath = p.substring(path.length + 1);
                const data = subPath ? _get(deletedObject, subPath) : deletedObject;
                if (data) {
                    const diffInfo = {
                        differences: DeleteKeyword,
                        hasDifferences: true,
                        hasDeletions: true,
                        deletions: data,
                    };
                    this.emit(PATH_EVENT_PREFIX + p, diffInfo, options);
                    if (options.fireGlobalChangeEvents) {
                        this.emit('change', childDiffs, p, options);
                    }
                }
            });
    */

    let keys = _keys(deletedObject);
    const isArray = _isArray(deletedObject);
    const affectedSubscriberPaths: string[] = this._listenedPaths.filter(p => p.startsWith(path));
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      const innerPath = pushKeyToPath(path, key, isArray);

      if (_isObject((deletedObject as any)[key])) {
        childDiffs = this._emitInnerDeletions(innerPath, (deletedObject as any)[key], options);
        levelDiffs.addChildTracking(childDiffs, key);
        this.emit(PATH_EVENT_PREFIX + innerPath, childDiffs, options);
        if (options.fireGlobalChangeEvents) {
          this.emit('change', childDiffs, innerPath, options);
        }
      } else {
        this.emit(PATH_EVENT_PREFIX + (innerPath || ''), { differences: DeleteKeyword, deletions: (deletedObject as any)[key] }, options);
        if (options.fireGlobalChangeEvents) {
          this.emit('change', { differences: DeleteKeyword, deletions: (deletedObject as any)[key] }, innerPath, options);
        }
      }

      // @ts-expect-error
      levelDiffs.differences[key] = DeleteKeyword;
    }

    // @ts-expect-error
    levelDiffs.selfDelete = true;
    levelDiffs.hasDeletions = true;
    levelDiffs.hasDifferences = true;
    levelDiffs.deletions = deletedObject;
    revoke(deletedObject);
    return levelDiffs;
  }

  get isReadOnly() {
    return false;
  }

  // @ts-expect-error
  getData({ immediateFlush } = {}) {
    return create(this);
  }

  destroyProxy() {
    if (this.proxies.has(this)) {
      revoke(this.proxies.get(this));
      this.proxies.delete(this);
    }
  }

  get data() {
    return this.getData();
  }
}

// @ts-expect-error
PatchDiff.prototype.override = PatchDiff.prototype.set;

// @ts-expect-error
PatchDiff.prototype.merge = PatchDiff.prototype.apply;

// @ts-expect-error
PatchDiff.prototype.patch = PatchDiff.prototype.apply;

// @ts-expect-error
PatchDiff.prototype.scope = PatchDiff.prototype.at;

export default PatchDiff;