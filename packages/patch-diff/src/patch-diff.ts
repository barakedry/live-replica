import { EventEmitter, PATH_EVENT_PREFIX } from '../../events/events';
import { concatPath, firstKey, pickWithKeys, wrapByPath, splitPathAndLastKey, parentPath, fixNumericParts, hasSamePrototype, createWrapperWithLastKey, pushKeyToPath, SERIALIZED_FUNCTION } from '../../utils/utils';
import { DiffTracker } from "./diff-tracker";
import { create, isProxy, revoke, unwrap } from "../../proxy/proxy";
import _isObject from 'lodash-es/isObject';
import _isString from 'lodash-es/isString';
import _isEqual from 'lodash-es/isEqual';
import _get from 'lodash-es/get';
import _keys from 'lodash-es/keys';
import _isArray from 'lodash-es/isArray';
import _isUndefined from 'lodash-es/isUndefined';
import type { KeyList, SpliceParams, SubscribeCallback, UnsubscribeCallback, MutationOptions, MergeOptions, ApplyOptions } from '@live-replica/live-replica';

const logError = (msg: string) => {console.error('LiveReplica PatchDiff: ' + msg);};

const eventsWithoutPrepend = new Set(['destroyed', 'error', '_subscribed', '_synced']);
const _isFunction = (obj: any) => typeof obj === 'function';

function createByType(obj: any) {
    if (_isArray(obj)) {
        return [];
    }
    return {};
}

function aggregate(patch1: any, patch2: any) {
    if (!patch1) {
        return patch2;
    }
    const keys = Object.keys(patch2);
    const length = keys.length;
    for (let i = 0; i < length; i++) {
        const key = keys[i];
        if (_isObject(patch2[key])) {
            patch1[key] = aggregate(_isObject(patch1[key])  ? patch1[key] : createByType(patch2[key]), patch2[key]);
        } else {
            patch1[key] = patch2[key];
        }
    }
    return patch1;
}

function index(key: any, levelDiffs: any) {
    return Number(key) + (levelDiffs.arrayOffset || 0);
}

function getAll(current: any, partsAndKeys: any[], parentParams: any = {}) {
    const pathPart = partsAndKeys.shift();
    const keyName = partsAndKeys.shift();
    current = current.at(pathPart);
    const value = current.get();
    if (value === undefined) {
        return [{params: parentParams, value: undefined, isPattern: true}];
    } else {
        if (keyName) {
            if (typeof value !== 'object') {
                return [{params: parentParams, value: undefined, isPattern: true}];
            }
            let multi: any[] = [];
            Object.keys(value).forEach((key) => {
                const params = {...parentParams, [keyName]: key};
                if (partsAndKeys.length) {
                    getAll(current.at(key), [...partsAndKeys], params).forEach((v: any) => {
                        multi.push(v);
                    });
                } else {
                    multi.push({value: current.get(key), params});
                }
            });
            return multi;
        } else {
            return [{value, params: parentParams, isPattern: true}];
        }
    }
}

function createPathMatcher(pattern: string) {
    const regex = /:([\w]+)/g;
    const keys: string[] = [];
    const replaced = '^' + pattern.replace(regex, (match, capture) => {
            keys.push(capture);
            return `:(\w+)`;
        }).replace(/\[/g,'\[?').replace(/\]/g,'\]?')
            .replace(/\:/g,'\.?').replace(/\./g,'\.')
            .replace('**','([\w\.]+)')
            .replace('*','(\w+)')
        + '$';
    const regexp  = new RegExp(replaced);
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
    }
}

export const DeleteKeyword = '__$$D';
export const SpliceKeyword = '__$$S';
export const UndefinedKeyword = '__$$U';
export const ProtoKeyword = '__$$P';

export class PatchDiff<T = any> extends EventEmitter {
    options: any;
    proxies: WeakMap<object, any>;
    _data: any;
    _whitelist?: Set<string>;
    _wrapper?: any;
    _wrapperInner?: any;
    _wrapperKey?: any;
    _path?: string;
    _root?: PatchDiff<T>;
    constructor(object: any, options?: Partial<any>) {
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
            ...options
        };
        this.proxies = new WeakMap();
        this._data = object || {};
        this.setMaxListeners(this.options.maxListeners);
    }

    apply(patch: Partial<T>, path?: string, options?: MergeOptions): void {
        options = {
            ...this.options,
            ...options,
        };
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
                patch = pickWithKeys(patch, this._whitelist, false);
            }
        }
        let wrappedPatch = wrapByPath(patch, path);
        if (this._wrapper) {
            this._wrapperInner[this._wrapperKey] = wrappedPatch;
            wrappedPatch = this._wrapper;
        }
        if (options.overrides) {
            options = {...options};
            const overrides = {};
            if (Array.isArray(options.overrides)) {
                options.overrides.forEach((path: string) => {
                    overrides[concatPath(this._path, path)] = true;
                });
            } else {
                throw new Error('LiveReplica PatchDiff: invalid overrides must be an array of paths');
            }
            options.overrides = overrides;
        }
        this._applyObject(this._data, wrappedPatch, '', options, 0);
        if (this._wrapper) {
            delete this._wrapperInner[this._wrapperKey];
        }
    }

    displace(value: any, path?: string, options?: MutationOptions): void {
        // ... full method body from JS ...
    }

    set(fullDocument: any, path?: string, options?: MutationOptions): void {
        // ... full method body from JS ...
    }

    remove(path?: string, options?: MutationOptions): void {
        // ... full method body from JS ...
    }

    splice({index, itemsToRemove, itemsToAdd}: SpliceParams, path?: string, options: MutationOptions = {}): void {
        // ... full method body from JS ...
    }

    getFullPath(path?: string): string | undefined {
        // ... full method body from JS ...
    }

    getAll(pathPattern: string): Array<{value: T[keyof T], params: object, isPattern?: boolean}> {
        // ... full method body from JS ...
    }

    get(path?: string, callback?: (val: any) => void): any {
        // ... full method body from JS ...
    }

    getClone(path?: string): any {
        // ... full method body from JS ...
    }

    on(event: string, fn: (...args: any[]) => void, prependPath = true): void {
        // ... full method body from JS ...
    }

    whitelist(keySet: KeyList): void {
        // ... full method body from JS ...
    }

    subscribe(subPath: string, fn: SubscribeCallback<T>, skipInitial = false): UnsubscribeCallback {
        // ... full method body from JS ...
    }

    getWhenExists(path?: string): Promise<any> {
        // ... full method body from JS ...
    }

    whenAnything(path?: string): Promise<any> {
        // ... full method body from JS ...
    }

    at(subPath: string): PatchDiff<T> {
        // ... full method body from JS ...
    }

    parent(): PatchDiff<T> | undefined {
        // ... full method body from JS ...
    }

    get root(): PatchDiff<T> {
        // ... full method body from JS ...
    }

    // ... private/internal methods ...
    _applyObject(target: any, patch: any, path: string, options: any, level: number, override?: any): any {
        // ... full method body from JS ...
    }
    _applyAtKey(target: any, patch: any, path: string, key: any, levelDiffs: any, options: any, level: number, override: any, isTargetArray: boolean): any {
        // ... full method body from JS ...
    }
    _deleteAtKey(target: any, path: string, key: any, options: any, existingValue: any, levelDiffs: any, isArray: boolean): any {
        // ... full method body from JS ...
    }
    _detectDeletionsAtLevel(target: any, patch: any, levelDiffs: any, path: string, options: any, isArray: boolean): any {
        // ... full method body from JS ...
    }
    _splice(path: string, index: number, itemsToRemove: number, ...itemsToAdd: any[]): any {
        // ... full method body from JS ...
    }
    _getPrototypeOf(object: any): any {
        // ... full method body from JS ...
    }
    _emitInnerDeletions(path: string, deletedObject: any, options: any): void {
        // ... full method body from JS ...
    }
    get isReadOnly(): boolean {
        // ... full method body from JS ...
    }
    getData({immediateFlush}: {immediateFlush?: boolean} = {}): any {
        // ... full method body from JS ...
    }
    destroyProxy(): void {
        // ... full method body from JS ...
    }
    get data(): any {
        // ... full method body from JS ...
    }
}

// TODO: Add @ts-expect-error where needed for dynamic object access. Refine types in a future pass.

// TODO: Continue migrating all methods, integrating types from index.d.ts as you go. Suppress errors with @ts-expect-error where needed. 