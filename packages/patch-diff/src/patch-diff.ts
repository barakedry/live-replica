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
  GetAllResult
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

export class PatchDiff extends EventEmitter {
  private options: Required<PatchDiffOptions>;
  private proxies: WeakMap<object, any>;
  private _data: Record<string, any>;
  private _whitelist?: Set<string>;
  private _path?: string;
  private _wrapper?: Record<string, any>;
  private _wrapperInner?: Record<string, any>;
  private _wrapperKey?: string;
  private _root?: PatchDiff;

  declare setMaxListeners: (n: number) => void;

  constructor(object?: Record<string, any>, options?: PatchDiffOptions) {
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
    this._data = object || {};
    this.setMaxListeners(this.options.maxListeners);
  }

  at(path: string): PatchDiff {
    // Implementation needed
    return this;
  }

  get(path?: string): any {
    // Implementation needed
    return path ? this._data[path] : this._data;
  }

  private _applyObject(target: Record<string, any>, patch: Record<string, any>, path: string, options: Required<PatchDiffOptions>, level: number): void {
    // Implementation needed
  }

  apply(patch: Record<string, any>, path?: string, options?: PatchDiffOptions): void {
    const mergedOptions: Required<PatchDiffOptions> = {
      ...this.options,
      ...(options || {})
    };

    if (!_isObject(patch) && !path && !this._path) {
      logError('invalid apply, target and patch must be objects');
      return;
    }

    if (isProxy(patch)) {
      patch = unwrap(patch);
    }

    let patchToApply: Record<string, any> = patch;

    if (this._whitelist) {
      if (path) {
        if (!this._whitelist.has(firstKey(path))) {
          return;
        }
      } else {
        patchToApply = pickWithKeys(patch, Array.from(this._whitelist), false) as Record<string, any>;
      }
    }

    let wrappedPatch = wrapByPath(patchToApply, path || '');
    if (this._wrapper) {
      this._wrapperInner![this._wrapperKey!] = wrappedPatch;
      wrappedPatch = this._wrapper;
    }

    if (mergedOptions.overrides) {
      const overrides: string[] = [];
      if (Array.isArray(mergedOptions.overrides)) {
        mergedOptions.overrides.forEach((path) => {
          overrides.push(concatPath(this._path || '', path));
        });
      } else {
        throw new Error('LiveReplica PatchDiff: invalid overrides must be an array of paths');
      }

      mergedOptions.overrides = overrides;
    }

    this._applyObject(this._data, wrappedPatch, '', mergedOptions, 0);

    if (this._wrapper) {
      delete this._wrapperInner![this._wrapperKey!];
    }
  }

  // ... Rest of the methods will follow in subsequent edits
} 