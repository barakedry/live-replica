"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchDiff = exports.ProtoKeyword = exports.UndefinedKeyword = exports.SpliceKeyword = exports.DeleteKeyword = void 0;
const events_1 = require("../../events/events");
const utils_1 = require("../../utils/utils");
const diff_tracker_1 = require("./diff-tracker");
const proxy_1 = require("../../proxy");
const isObject_1 = __importDefault(require("lodash-es/isObject"));
const isString_1 = __importDefault(require("lodash-es/isString"));
const isEqual_1 = __importDefault(require("lodash-es/isEqual"));
const get_1 = __importDefault(require("lodash-es/get"));
const keys_1 = __importDefault(require("lodash-es/keys"));
const isArray_1 = __importDefault(require("lodash-es/isArray"));
const isUndefined_1 = __importDefault(require("lodash-es/isUndefined"));
const logError = (msg) => { console.error('LiveReplica PatchDiff: ' + msg); };
const eventsWithoutPrepend = new Set(['destroyed', 'error', '_subscribed', '_synced']);
const _isFunction = (obj) => typeof obj === 'function';
function createByType(obj) {
    if ((0, isArray_1.default)(obj)) {
        return [];
    }
    return {};
}
function aggregate(patch1, patch2) {
    if (!patch1) {
        return patch2;
    }
    const keys = Object.keys(patch2);
    const length = keys.length;
    for (let i = 0; i < length; i++) {
        const key = keys[i];
        if ((0, isObject_1.default)(patch2[key])) {
            patch1[key] = aggregate((0, isObject_1.default)(patch1[key]) ? patch1[key] : createByType(patch2[key]), patch2[key]);
        }
        else {
            patch1[key] = patch2[key];
        }
    }
    return patch1;
}
function index(key, levelDiffs) {
    return Number(key) + (levelDiffs.arrayOffset || 0);
}
function getAll(current, partsAndKeys, parentParams = {}) {
    const pathPart = partsAndKeys.shift();
    const keyName = partsAndKeys.shift();
    current = current.at(pathPart);
    const value = current.get();
    if (value === undefined) {
        return [{ params: parentParams, value: undefined, isPattern: true }];
    }
    else {
        if (keyName) {
            if (typeof value !== 'object') {
                return [{ params: parentParams, value: undefined, isPattern: true }];
            }
            let multi = [];
            Object.keys(value).forEach((key) => {
                const params = { ...parentParams, [keyName]: key };
                if (partsAndKeys.length) {
                    getAll(current.at(key), [...partsAndKeys], params).forEach((v) => {
                        multi.push(v);
                    });
                }
                else {
                    multi.push({ value: current.get(key), params, isPattern: true });
                }
            });
            return multi;
        }
        else {
            return [{ value, params: parentParams, isPattern: true }];
        }
    }
}
function createPathMatcher(pattern) {
    // Escape special regex characters in the pattern
    const regex = /:([\w]+)/g;
    const keys = [];
    const replaced = '^' + pattern.replace(regex, (match, capture) => {
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
    return function match(path) {
        const matches = path.match(regexp);
        if (!matches) {
            return null;
        }
        const params = {};
        keys.forEach((key, index) => {
            params[key] = matches[index + 1];
        });
        return params;
    };
}
exports.DeleteKeyword = '__$$D';
exports.SpliceKeyword = '__$$S';
exports.UndefinedKeyword = '__$$U';
exports.ProtoKeyword = '__$$P';
class PatchDiff extends events_1.EventEmitter {
    constructor(object, options) {
        super();
        this._listenedPaths = [];
        this.options = {
            emitEvents: true,
            undefinedKeyword: exports.UndefinedKeyword,
            deleteKeyword: exports.DeleteKeyword,
            spliceKeyword: exports.SpliceKeyword,
            protoKeyword: exports.ProtoKeyword,
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
    apply(patch, path, options) {
        //path = concatPath(this._path, path);
        options = {
            ...this.options,
            ...options,
        };
        if (!(0, isObject_1.default)(patch) && !path && !this._path) {
            logError('invalid apply, target and patch must be objects');
            return;
        }
        if ((0, proxy_1.isProxy)(patch)) {
            patch = (0, proxy_1.unwrap)(patch);
        }
        if (this._whitelist) {
            if (path) {
                if (!this._whitelist.has((0, utils_1.firstKey)(path))) {
                    return;
                }
            }
            else {
                // @ts-expect-error
                patch = (0, utils_1.pickWithKeys)(patch, this._whitelist, false);
            }
        }
        let wrappedPatch = (0, utils_1.wrapByPath)(patch, path);
        if (this._wrapper) {
            // @ts-expect-error
            this._wrapperInner[this._wrapperKey] = wrappedPatch;
            wrappedPatch = this._wrapper;
        }
        // adjustOverrides - allows to override/set specific paths in the patch
        if (options.overrides) {
            options = { ...options };
            const overrides = {};
            if (Array.isArray(options.overrides)) {
                options.overrides.forEach((path) => {
                    overrides[(0, utils_1.concatPath)(this._path, path)] = true;
                });
            }
            else {
                throw new Error('LiveReplica PatchDiff: invalid overrides must be an array of paths');
            }
            options.overrides = overrides;
        }
        // @ts-expect-error
        this._applyObject(this._data, wrappedPatch, '', options, 0);
        if (this._wrapper) {
            // @ts-expect-error
            delete this._wrapperInner[this._wrapperKey];
        }
    }
    displace(value, path, options) {
        if (this._whitelist) {
            throw new Error('LiveReplica PatchDiff: set is not supported with whitelist');
        }
        options = {
            ...this.options,
            ...options,
        };
        // @ts-expect-error
        const fullPath = (0, utils_1.concatPath)(this._path, path);
        if (fullPath && (!(0, isString_1.default)(fullPath))) {
            logError('cannot displace, invalid path');
            return;
        }
        const rootPatcher = (this._root || this);
        const safeFullPath = fullPath || '';
        const affectedPaths = this._listenedPaths.filter(p => p.startsWith(safeFullPath) || safeFullPath.startsWith(p));
        const currentValuesByPath = {};
        affectedPaths.forEach((path) => {
            // if affected by this change
            const data = rootPatcher.get(path, undefined);
            currentValuesByPath[path] = data;
        });
        // set the root data
        if (!fullPath) {
            this._data = structuredClone(value);
        }
        else {
            const { path: parenPath, key } = (0, utils_1.splitPathAndLastKey)(fullPath);
            const parent = rootPatcher.get(parenPath, undefined);
            if (!parent) {
                rootPatcher.displace({ [key]: value }, parenPath); // this will create the parent object
                return;
            }
            if (value === this.options.deleteKeyword) {
                delete rootPatcher.get(parenPath)[key];
            }
            else {
                rootPatcher.get(parenPath)[key] = structuredClone(value);
            }
        }
        affectedPaths.forEach((path) => {
            // if affected by this change
            const data = rootPatcher.get(path, undefined);
            if (data !== currentValuesByPath[path]) {
                this.emit(events_1.PATH_EVENT_PREFIX + path, { differences: data, hasDifferences: true, changeType: 'displace' }, options);
            }
        });
        //this.emit(PATH_EVENT_PREFIX, {differences: this._data, hasDifferences: true, changeType: 'displace'}, options);
        let differences = rootPatcher.get(fullPath);
        let currPath = fullPath;
        this.emit(events_1.PATH_EVENT_PREFIX + currPath, { differences, hasDifferences: true, changeType: 'displace' }, options);
        if (currPath) {
            // bubble up the change
            let split = (0, utils_1.splitPathAndLastKey)(currPath);
            while (split.path || split.key) {
                differences = { [split.key]: differences };
                this.emit(events_1.PATH_EVENT_PREFIX + split.path, { differences, hasDifferences: true }, options);
                currPath = split.path;
                split = (0, utils_1.splitPathAndLastKey)(currPath);
            }
        }
    }
    set(fullDocument, path, options) {
        options = {
            ...this.options,
            ...options,
        };
        if (!(0, isObject_1.default)(fullDocument) && !path && !this._path) {
            logError('invalid set, fullDocument must be an object');
            return;
        }
        if (this._whitelist) {
            throw new Error('LiveReplica PatchDiff: set is not supported with whitelist');
        }
        if ((0, proxy_1.isProxy)(fullDocument)) {
            fullDocument = (0, proxy_1.unwrap)(fullDocument);
        }
        let wrapped = (0, utils_1.wrapByPath)(fullDocument, path);
        if (this._wrapper) {
            // @ts-expect-error
            this._wrapperInner[this._wrapperKey] = wrapped;
            wrapped = this._wrapper;
        }
        this._applyObject(this._data, wrapped, '', options, 0, (0, utils_1.concatPath)(this._path || '', path || '') || true);
        if (this._wrapper) {
            // @ts-expect-error
            delete this._wrapperInner[this._wrapperKey];
        }
    }
    remove(path, options) {
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
        if (path && this._whitelist && !this._whitelist.has((0, utils_1.firstKey)(path))) {
            return;
        }
        let wrapped = (0, utils_1.wrapByPath)(exports.DeleteKeyword, path);
        if (this._wrapper) {
            // @ts-expect-error
            this._wrapperInner[this._wrapperKey] = wrapped;
            wrapped = this._wrapper;
        }
        // @ts-expect-error
        this._applyObject(this._data, wrapped, '', options, 0);
        if (this._wrapper) {
            // @ts-expect-error
            delete this._wrapperInner[this._wrapperKey];
        }
    }
    splice({ index, itemsToRemove, itemsToAdd }, path, options) {
        options = {
            ...this.options,
            ...options,
        };
        // @ts-expect-error
        path = (0, utils_1.concatPath)(this._path, path);
        // @ts-expect-error
        this._applyObject(this._data, (0, utils_1.wrapByPath)({ [exports.SpliceKeyword]: { index, itemsToRemove, itemsToAdd } }, path), '', options, 0);
    }
    getFullPath(path) {
        // @ts-expect-error
        return (0, utils_1.concatPath)(this._path, path);
    }
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
        const partsAndKeys = pathPattern.split(/\[:+|\]\./).map((item, index) => { return index > 0 ? item.split(']')[0] : item; });
        // @ts-expect-error
        return (getAll(this, partsAndKeys, {}) ?? []).filter(v => !!v);
    }
    get(path, callback) {
        if (typeof path === 'function') {
            callback = path;
            path = undefined;
        }
        const fullPath = (0, utils_1.concatPath)(this._path || '', path || '');
        if (fullPath && (!(0, isString_1.default)(fullPath))) {
            logError('invalid path, cannot get');
            return;
        }
        let retVal;
        if (fullPath) {
            retVal = (0, get_1.default)(this._data, fullPath);
        }
        else {
            retVal = this._data;
        }
        if (this._whitelist) {
            if (path) {
                if (!this._whitelist.has((0, utils_1.firstKey)(path))) {
                    return undefined;
                }
            }
            else if (retVal) {
                // @ts-expect-error
                retVal = (0, utils_1.pickWithKeys)(retVal, this._whitelist);
            }
        }
        if (callback) {
            if (retVal) {
                callback(retVal);
            }
            else {
                // subscribe for first data
                let unsub;
                let once;
                const parent = (0, utils_1.parentPath)(path);
                unsub = this.subscribe(parent || '', (data) => {
                    if (!once) {
                        const value = (0, get_1.default)(this._data, fullPath);
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
    getClone(path) {
        let obj = this.get(path, undefined);
        if (obj) {
            if (this._whitelist) {
                obj = (0, utils_1.pickWithKeys)(obj, Array.from(this._whitelist));
            }
            return structuredClone(obj);
        }
        return undefined;
    }
    on(event, fn) {
        const result = super.on(event, fn);
        // Track only path events (not patterns, not empty)
        if (typeof event === 'string' && event.startsWith(events_1.PATH_EVENT_PREFIX)) {
            const path = event.substring(events_1.PATH_EVENT_PREFIX.length);
            if (path && !this._listenedPaths.includes(path)) {
                this._listenedPaths.push(path);
            }
        }
        return result;
    }
    off(event, fn) {
        super.off(event, fn);
        // Remove from _listenedPaths if no more listeners for this path
        if (typeof event === 'string' && event.startsWith(events_1.PATH_EVENT_PREFIX)) {
            const path = event.substring(events_1.PATH_EVENT_PREFIX.length);
            if (path) {
                const count = this.listenerCount(event);
                if (count === 0) {
                    this._listenedPaths = this._listenedPaths.filter(p => p !== path);
                }
            }
        }
    }
    whitelist(keySet) {
        if (Array.isArray(keySet)) {
            keySet = new Set(keySet);
        }
        let addedKeys = [];
        let removedKeys = [];
        const existingKeys = this._whitelist || new Set();
        if (this._whitelist) {
            addedKeys = Array.from(keySet).filter(key => !this._whitelist.has(key));
            removedKeys = Array.from(this._whitelist).filter(key => !keySet.has(key));
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
                deletions[key] = this.get(key, undefined);
                differences[key] = exports.DeleteKeyword;
            });
            addedKeys.forEach(key => {
                const val = this.get(key, undefined);
                if (val !== undefined) {
                    differences[key] = val;
                    additions[key] = val;
                    hasAdditions = true;
                }
            });
            let path = this._path || '';
            path = path || '';
            path = (0, utils_1.fixNumericParts)(path || '');
            this.emit(events_1.PATH_EVENT_PREFIX + path, { differences, hasDifferences: true, hasDeletions, hasAdditions, deletions, additions, changeType: 'whitelist-change' }, {});
            if (this.options.fireGlobalChangeEvents) {
                this.emit('change', { differences, hasDifferences: true, hasDeletions, hasAdditions, deletions, additions, changeType: 'whitelist-change' }, path, {});
            }
        }
        this._whitelist = keySet;
    }
    /**
     * Note: the signature of this method is a little bit wonky as we allow subPath to not be provided,
     * pushing the remaining parameters left.
     */
    subscribe(subPath, fn, skipInitial = false) {
        if (typeof subPath === 'function') {
            skipInitial = !!fn;
            fn = subPath;
            subPath = '';
        }
        const cb = fn;
        let aggregatedPatch;
        let aggregatedChangesInfo;
        let lastOptions;
        let lastTimeout;
        const flush = () => {
            if (!aggregatedPatch) {
                return;
            }
            cb?.(aggregatedPatch, aggregatedChangesInfo, lastOptions?.context || {}, true, lastOptions?.params);
            aggregatedPatch = undefined;
            aggregatedChangesInfo = undefined;
            lastOptions = undefined;
            lastTimeout = undefined;
        };
        fn = (patch, changesInfo, options) => {
            clearTimeout(lastTimeout);
            const flushNow = options.defer !== true ||
                typeof patch !== 'object' ||
                changesInfo.snapshot ||
                (lastOptions?.type && lastOptions.type !== options.type) ||
                (lastOptions?.context && !(0, isEqual_1.default)(lastOptions.context, options.context));
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
            }
            else {
                fn(this.get(subPath, undefined), { snapshot: true }, this.options);
            }
        }
        let path = (0, utils_1.concatPath)(this._path || '', subPath || '');
        path = path || '';
        path = (0, utils_1.fixNumericParts)(path || '');
        let handler = (diff, options) => {
            fn(diff.differences, diff, options);
        };
        if (this._whitelist) {
            handler = (diff, options) => {
                const delta = (0, utils_1.pickWithKeys)(diff.differences, Array.from(this._whitelist));
                if (delta) {
                    fn(delta, diff, options);
                }
            };
        }
        let changeHandler;
        if (isPattern) {
            (this._root || this).options.fireGlobalChangeEvents = true;
            const match = createPathMatcher(path);
            changeHandler = (diff, path, options) => {
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
        }
        else {
            super.on(events_1.PATH_EVENT_PREFIX + path, handler);
        }
        return () => {
            clearTimeout(lastTimeout);
            if (!handler) {
                return;
            }
            this.removeListener(events_1.PATH_EVENT_PREFIX + path, handler);
            if (changeHandler) {
                this.removeListener('change', changeHandler);
            }
            handler = (() => { });
        };
    }
    getWhenExists(path) {
        return new Promise(resolve => {
            this.get(path, resolve);
        });
    }
    whenAnything(path) {
        return new Promise(resolve => {
            const unsub = this.subscribe(path, (data) => {
                if (typeof data === 'object' && Object.keys(data).length !== 0) {
                    resolve(data);
                    setTimeout(() => unsub(), 0);
                }
            });
        });
    }
    at(subPath) {
        let path = (0, utils_1.concatPath)(this._path || '', subPath || '');
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
        at._path = (0, utils_1.fixNumericParts)(path || '');
        const { wrapper, wrapperInner, lastKey } = (0, utils_1.createWrapperWithLastKey)(path || '');
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
        const { path: parentPathVal, key } = (0, utils_1.splitPathAndLastKey)(this._path || '');
        const parent = root.at(parentPathVal).get();
        return parent;
    }
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
    _applyObject(target, patch, path, options, level, override) {
        if (!((0, isObject_1.default)(target) && (0, isObject_1.default)(patch))) {
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
        let keys = (0, keys_1.default)(patch);
        let length = keys.length;
        let isTargetArray = (0, isArray_1.default)(target);
        if (options.emitEvents) {
            levelDiffs = diff_tracker_1.DiffTracker.create(isTargetArray && target.length === 0 && (0, isArray_1.default)(patch), options.deletePatch);
            levelDiffs.path = path;
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
            const patchVal = patch[key];
            if (patchVal !== target[key] && patchVal === patchVal) {
                levelDiffs = this._applyAtKey(target, patch, path, key, levelDiffs, options, level, override, isTargetArray);
            }
        }
        // override is either undefined, a path or true
        if ((!(0, isUndefined_1.default)(override) && (override === true || path.indexOf(override) === 0)) || (options.overrides && (options.overrides[path]))) {
            levelDiffs = this._detectDeletionsAtLevel(target, patch, levelDiffs, path, options, isTargetArray);
        }
        if (options.emitEvents && levelDiffs.hasDifferences) {
            this.emit(events_1.PATH_EVENT_PREFIX + (path || ''), levelDiffs, options);
            if (options.fireGlobalChangeEvents) {
                this.emit('change', levelDiffs, path, options);
            }
        }
        return levelDiffs;
    }
    _applyAtKey(target, patch, path, key, levelDiffs, options, level, override, isTargetArray) {
        let childDiffs, patchValue, existingValue, srcKey, appliedValue, // this value is what goes out to the tracker its not always the same as patchValue
        isExistingValueArray, isPatchValueObject = false;
        patchValue = patch[key];
        srcKey = key;
        // splice treat as primitive
        if (key === exports.SpliceKeyword) {
            appliedValue = this._splice(path, patchValue.index, patchValue.itemsToRemove || 0, ...(patchValue.itemsToAdd || []));
            target[srcKey] = patchValue;
            levelDiffs.hasUpdates = true;
            levelDiffs.hasDifferences = true;
            levelDiffs.differences[key] = appliedValue;
            return levelDiffs;
        }
        if (_isFunction(patchValue)) {
            appliedValue = utils_1.SERIALIZED_FUNCTION;
        }
        else {
            isPatchValueObject = (0, isObject_1.default)(patchValue);
            if ((0, isUndefined_1.default)(patchValue)) {
                appliedValue = exports.UndefinedKeyword;
            }
            else if (patchValue === exports.UndefinedKeyword) {
                appliedValue = patchValue;
                patchValue = undefined;
            }
            else {
                appliedValue = patchValue;
            }
        }
        if (isTargetArray) {
            srcKey = index(srcKey, levelDiffs);
        }
        // new
        if (!target.hasOwnProperty(srcKey)) {
            if (patch[key] !== exports.DeleteKeyword && !options.deletePatch) {
                levelDiffs.hasAdditions = true;
                levelDiffs.hasDifferences = true;
                // add new object
                if (isPatchValueObject) {
                    target[srcKey] = patchValue.constructor.call(Object.create(Object.getPrototypeOf(patchValue)));
                    childDiffs = this._applyObject(target[srcKey], patchValue, (0, utils_1.pushKeyToPath)(path, key, isTargetArray), options, level + 1, override, 
                    // @ts-expect-error
                    isTargetArray);
                    levelDiffs.addChildTracking(childDiffs, key, true);
                    // empty object
                    if (!childDiffs.hasAdditions) {
                        levelDiffs.additions[key] = appliedValue;
                        levelDiffs.differences[key] = appliedValue;
                    }
                    // add new primitive
                }
                else {
                    target[srcKey] = patchValue;
                    levelDiffs.additions[key] = appliedValue;
                    levelDiffs.differences[key] = appliedValue;
                    const leafPath = (0, utils_1.pushKeyToPath)(path, srcKey, isTargetArray);
                    this.emit(events_1.PATH_EVENT_PREFIX + (leafPath || ''), { differences: appliedValue, additions: appliedValue }, options);
                    if (options.fireGlobalChangeEvents) {
                        this.emit('change', { differences: appliedValue, additions: appliedValue }, leafPath, options);
                    }
                }
            }
            // existing
        }
        else {
            existingValue = target[srcKey];
            isExistingValueArray = (0, isArray_1.default)(existingValue);
            // remove
            if (patch[key] === exports.DeleteKeyword) {
                levelDiffs = this._deleteAtKey(target, path, key, options, existingValue, levelDiffs, isTargetArray);
                // update object
            }
            else if (isPatchValueObject) {
                // we should replace the target value, todo: array merges check is not sufficient
                if (!isExistingValueArray && !(0, utils_1.hasSamePrototype)(existingValue, patchValue)) {
                    // this is a restructure
                    // handle prototypes
                    target[srcKey] = Object.create(this._getPrototypeOf(patchValue));
                }
                childDiffs = this._applyObject(target[srcKey], patchValue, (0, utils_1.pushKeyToPath)(path, key, isTargetArray), options, level + 1, override);
                levelDiffs.addChildTracking(childDiffs, key);
                // update primitive
            }
            else {
                target[srcKey] = patchValue;
                const updates = {
                    oldVal: existingValue,
                    newVal: appliedValue
                };
                levelDiffs.hasUpdates = true;
                levelDiffs.hasDifferences = true;
                levelDiffs.updates[key] = updates;
                levelDiffs.differences[key] = appliedValue;
                const leafPath = (0, utils_1.pushKeyToPath)(path, srcKey, isTargetArray);
                //this.emit(PATH_EVENT_PREFIX + (leafPath || ''),  {differences: appliedValue}, {...options, type: 'update', oldValue: existingValue});
                this.emit(events_1.PATH_EVENT_PREFIX + (leafPath || ''), { differences: appliedValue, updates }, options);
                if (options.fireGlobalChangeEvents) {
                    this.emit('change', { differences: appliedValue, updates }, leafPath, options);
                }
            }
        }
        return levelDiffs;
    }
    _deleteAtKey(target, path, key, options, existingValue, levelDiffs, isArray) {
        if (isArray) {
            target.splice(index(key, levelDiffs), 1);
            levelDiffs.arrayOffset = (levelDiffs.arrayOffset || 0) - 1;
        }
        else {
            delete target[key];
        }
        if (existingValue === undefined) {
            return levelDiffs;
        }
        levelDiffs.deletions[key] = existingValue;
        levelDiffs.differences[key] = exports.DeleteKeyword;
        levelDiffs.hasDeletions = true;
        levelDiffs.hasDifferences = true;
        if ((0, isObject_1.default)(existingValue) && !options.skipInnerDeletionEvents) {
            //levelDiffs.addChildTracking(this._emitInnerDeletions(path, existingValue, options), key)
            const childDiffs = this._emitInnerDeletions((0, utils_1.pushKeyToPath)(path, key, isArray), existingValue, options);
            levelDiffs.addChildTracking(childDiffs, key);
        }
        const eventPath = (0, utils_1.pushKeyToPath)(path, key) || '';
        this.emit(events_1.PATH_EVENT_PREFIX + eventPath, {
            differences: exports.DeleteKeyword,
            deletions: existingValue,
            hasDeletions: true,
            hasDifferences: true,
            hasUpdates: false,
            hasAdditions: false,
            hasAddedObjects: false
        }, options);
        if (options.fireGlobalChangeEvents) {
            this.emit('change', {
                differences: exports.DeleteKeyword,
                deletions: existingValue,
                hasDeletions: true,
                hasDifferences: true,
                hasUpdates: false,
                hasAdditions: false,
                hasAddedObjects: false
            }, eventPath, options);
        }
        if ((0, isObject_1.default)(existingValue)) {
            (0, proxy_1.revoke)(existingValue);
        }
        return levelDiffs;
    }
    // @ts-expect-error
    _detectDeletionsAtLevel(target, patch, levelDiffs, path, options, isTargetArray) {
        const keys = (0, keys_1.default)(target), length = keys.length;
        let existingValue, key, i;
        // run target object at this level
        for (i = 0; i < length; i++) {
            key = keys[i];
            if (patch[key] === undefined) {
                existingValue = target[key];
                this._deleteAtKey(target, path, key, options, existingValue, levelDiffs, isTargetArray);
            }
            else if (typeof patch[key] === 'object') {
                const diffs = diff_tracker_1.DiffTracker.create((0, isArray_1.default)(target[key]) && target[key].length === 0 && (0, isArray_1.default)(patch[key]), options.deletePatch);
                this._detectDeletionsAtLevel(target[key], patch[key], diffs, (0, utils_1.pushKeyToPath)(path, key, isTargetArray), options, Array.isArray(target[key]));
                levelDiffs.addChildTracking(diffs, key);
            }
        }
        return levelDiffs;
    }
    _splice(path, index, itemsToRemove, ...itemsToAdd) {
        const target = this.get(path, undefined);
        if (!(0, isArray_1.default)(target)) {
            logError('invalid splice, target must be an array');
            return { deleted: [] };
        }
        const deleted = target.splice(index, itemsToRemove, ...itemsToAdd);
        const diff = { index, itemsToRemove, itemsToAdd, deleted };
        return diff;
    }
    _getPrototypeOf(object) {
        return Object.getPrototypeOf(object);
    }
    _emitInnerDeletions(path, deletedObject, options) {
        let levelDiffs, childDiffs;
        if (!(0, isObject_1.default)(deletedObject)) {
            return;
        }
        levelDiffs = diff_tracker_1.DiffTracker.create(false, options.deletePatch);
        levelDiffs.path = path;
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
        let keys = (0, keys_1.default)(deletedObject);
        const isArray = (0, isArray_1.default)(deletedObject);
        const affectedSubscriberPaths = this._listenedPaths.filter(p => p.startsWith(path));
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            const innerPath = (0, utils_1.pushKeyToPath)(path, key, isArray);
            if ((0, isObject_1.default)(deletedObject[key])) {
                childDiffs = this._emitInnerDeletions(innerPath, deletedObject[key], options);
                levelDiffs.addChildTracking(childDiffs, key);
                this.emit(events_1.PATH_EVENT_PREFIX + innerPath, childDiffs, options);
                if (options.fireGlobalChangeEvents) {
                    this.emit('change', childDiffs, innerPath, options);
                }
            }
            else {
                this.emit(events_1.PATH_EVENT_PREFIX + (innerPath || ''), { differences: exports.DeleteKeyword, deletions: deletedObject[key] }, options);
                if (options.fireGlobalChangeEvents) {
                    this.emit('change', { differences: exports.DeleteKeyword, deletions: deletedObject[key] }, innerPath, options);
                }
            }
            // @ts-expect-error
            levelDiffs.differences[key] = exports.DeleteKeyword;
        }
        // @ts-expect-error
        levelDiffs.selfDelete = true;
        levelDiffs.hasDeletions = true;
        levelDiffs.hasDifferences = true;
        levelDiffs.deletions = deletedObject;
        (0, proxy_1.revoke)(deletedObject);
        return levelDiffs;
    }
    get isReadOnly() {
        return false;
    }
    getData({} = {}) {
        return (0, proxy_1.create)(this);
    }
    destroyProxy() {
        if (this.proxies.has(this)) {
            (0, proxy_1.revoke)(this.proxies.get(this));
            this.proxies.delete(this);
        }
    }
    get data() {
        return this.getData();
    }
}
exports.PatchDiff = PatchDiff;
// @ts-expect-error
PatchDiff.prototype.override = PatchDiff.prototype.set;
// @ts-expect-error
PatchDiff.prototype.merge = PatchDiff.prototype.apply;
// @ts-expect-error
PatchDiff.prototype.patch = PatchDiff.prototype.apply;
// @ts-expect-error
PatchDiff.prototype.scope = PatchDiff.prototype.at;
exports.default = PatchDiff;
//# sourceMappingURL=patch-diff.js.map