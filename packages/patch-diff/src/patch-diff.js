import { EventEmitter, PATH_EVENT_PREFIX } from '../../events/events.js';
import { Utils } from '../../utils/utils.js';
import { DiffTracker } from "./diff-tracker.js";
import {create, isProxy, revoke, unwrap} from "../../proxy/proxy.js";

const logError = (msg) => {console.error('LiveReplica PatchDiff: ' + msg);};

import _isObject from '../../../node_modules/lodash-es/isObject.js';
import _isString from '../../../node_modules/lodash-es/isString.js';
import _isEqual from '../../../node_modules/lodash-es/isEqual.js';
import _get from '../../../node_modules/lodash-es/get.js';
import _keys from '../../../node_modules/lodash-es/keys.js';
import _isArray from '../../../node_modules/lodash-es/isArray.js';
import _isUndefined from '../../../node_modules/lodash-es/isUndefined.js';

const eventsWithoutPrepend = new Set(['destroyed', 'error', '_subscribed', '_synced']);

const _isFunction = (obj) => typeof obj === 'function';

function createByType(obj) {
    if (_isArray(obj)) {
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
        if (_isObject(patch2[key])) {
            patch1[key] = aggregate(_isObject(patch1[key])  ? patch1[key] : createByType(patch2[key]), patch2[key]);
        } else {
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
        return [{params: parentParams, value: undefined, isPattern: true}];
    } else {
        if (keyName) {
            if (typeof value !== 'object') {
                return [{params: parentParams, value: undefined, isPattern: true}];
            }

            let multi = [];
            Object.keys(value).forEach((key) => {
                const params = {...parentParams, [keyName]: key};
                if (partsAndKeys.length) {
                    getAll(current.at(key), [...partsAndKeys], params).forEach((v) => {
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

function createPathMatcher(pattern) {
    // Escape special regex characters in the pattern
    const regex = /:([\w]+)/g;
    const keys = [];
    const replaced = '^' + pattern.replace(regex, (match, capture) => {
            keys.push(capture);
            return `:(\\w+)`;
            // }).replace(/\[/g,'\\\[?').replace(/\]/g,'\\\]?')
            //   .replace(/\:/g,'\.?').replace(/\./g,'\\.') + '$';

        }).replace(/\[/g,'\\\[?').replace(/\]/g,'\\\]?')
            .replace(/\:/g,'\.?').replace(/\./g,'\\.')
            .replace('**','([\\w\\.]+)')
            .replace('*','(\\w+)')
        + '$';

    const regexp  = new RegExp(replaced);

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
    }
}

export const DeleteKeyword = '__$$D';
export const SpliceKeyword = '__$$S';
export const UndefinedKeyword = '__$$U';
export const ProtoKeyword = '__$$P';

export class PatchDiff extends EventEmitter {

    constructor(object, options) {

        super();

        this.options = {
            emitEvents: true, //settings this to false should allow faster merging but it is not implemented yet
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
        //this.prototypes = []; // prototypes are stored in a special collection
    }

    apply(patch, path, options) {

        //path = Utils.concatPath(this._path, path);
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
                if (!this._whitelist.has(Utils.firstKey(path))) {
                    return;
                }
            } else {
                patch = Utils.pickWithKeys(patch, this._whitelist, false);
            }
        }

        let wrappedPatch = Utils.wrapByPath(patch, path);
        if (this._wrapper) {
            this._wrapperInner[this._wrapperKey] = wrappedPatch
            wrappedPatch = this._wrapper;
        }

        // adjustOverrides - allows to override/set specific paths in the patch
        if (options.overrides) {
            options = {...options};
            const overrides = {};
            if (Array.isArray(options.overrides)) {
                options.overrides.forEach((path) => {
                    overrides[Utils.concatPath(this._path, path)] = true;
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

    displace(value, path, options) {
        if (this._whitelist) {
            throw new Error('LiveReplica PatchDiff: set is not supported with whitelist');
        }

        options = {
            ...this.options,
            ...options,
        };

        const fullPath = Utils.concatPath(this._path, path);

        if (fullPath && (!_isString(fullPath))) {
            logError('cannot displace, invalid path');
            return;
        }

        const rootPatcher = (this._root || this);

        const affectedPaths = this.listenedPaths.filter(p => p.startsWith(fullPath) || fullPath.startsWith(p));

        const currentValuesByPath = {};
        affectedPaths.forEach((path) => {
            // if affected by this change
            const data = rootPatcher.get(path);
            currentValuesByPath[path] = data;
        });

        // set the root data
        if (!fullPath) {
            this._data = structuredClone(value);
        } else {
            const {path:parenPath, key} = Utils.splitPathAndLastKey(fullPath);

            const parent = rootPatcher.get(parenPath);
            if (!parent) {
                rootPatcher.displace({[key]: value}, parenPath); // this will create the parent object
                return;
            }

            rootPatcher.get(parenPath)[key] = structuredClone(value);
        }


        affectedPaths.forEach((path) => {
            // if affected by this change
            const data = rootPatcher.get(path);
            if (data !== currentValuesByPath[path]) {
                this.emit(PATH_EVENT_PREFIX + path, {differences: data, hasDifferences: true, changeType: 'displace'}, options);
            }
        });

        //this.emit(PATH_EVENT_PREFIX, {differences: this._data, hasDifferences: true, changeType: 'displace'}, options);

        let differences = rootPatcher.get(fullPath);
        let currPath = fullPath;
        this.emit(PATH_EVENT_PREFIX + currPath, {differences, hasDifferences: true, changeType: 'displace'}, options);

        if (currPath) {
            // bubble up the change

            let split = Utils.splitPathAndLastKey(currPath);
            while (split.path || split.key) {
                differences = {[split.key]: differences};
                this.emit(PATH_EVENT_PREFIX + split.path, {differences, hasDifferences: true}, options);
                currPath = split.path;
                split = Utils.splitPathAndLastKey(currPath);
            }
        }
    }


    set(fullDocument, path, options) {

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

        let wrapped = Utils.wrapByPath(fullDocument, path);

        if (this._wrapper) {
            this._wrapperInner[this._wrapperKey] = wrapped
            wrapped = this._wrapper;
        }


        this._applyObject(this._data, wrapped, '', options, 0, Utils.concatPath(this._path, path) || true);

        if (this._wrapper) {
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
            this._data = Array.isArray(this._data) ? [] : {};
            return;
        }

        if (this._whitelist && !this._whitelist.has(Utils.firstKey(path))) {
            return;
        }

        let wrapped = Utils.wrapByPath(DeleteKeyword, path);
        if (this._wrapper) {
            this._wrapperInner[this._wrapperKey] = wrapped
            wrapped = this._wrapper;
        }


        this._applyObject(this._data, wrapped, '', options, 0);

        if (this._wrapper) {
            delete this._wrapperInner[this._wrapperKey];
        }

    }

    splice({index, itemsToRemove, itemsToAdd}, path, options = {}) {
        options = {
            ...this.options,
            ...options,
        };

        path = Utils.concatPath(this._path, path);
        this._applyObject(this._data, Utils.wrapByPath({[SpliceKeyword]: {index, itemsToRemove, itemsToAdd}}, path), '', options, 0);
    }

    getFullPath(path) {
        return Utils.concatPath(this._path, path);
    }

    getAll(pathPattern) {

        const isPattern = pathPattern && (pathPattern.includes('*') || pathPattern.includes(':'));
        if (!isPattern) {
            return [{value: this.get(pathPattern), params: {}, isPattern: false}];
        }

        let unnamedKeys = [];
        pathPattern = pathPattern.replaceAll("*", (match) => {
            const keyName = `$key_${unnamedKeys.length}`;
            unnamedKeys.push(keyName);
            return `[:${keyName}]`;
        });

        const partsAndKeys = pathPattern.split(/\[:+|\]\./).map((item, index) => { return index > 0 ? item.split(']')[0] : item});

        return (getAll(this, partsAndKeys, {}) || []).filter(v => !!v);
    }

    get(path, callback) {

        if (typeof path === 'function') {
            callback = path;
            path = undefined;
        }

        const fullPath = Utils.concatPath(this._path, path);
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
                if (!this._whitelist.has(Utils.firstKey(path))) {
                    return undefined;
                }
            } else if (retVal) {
                retVal = Utils.pickWithKeys(retVal, this._whitelist);
            }
        }


        if (callback) {
            if (retVal) {
                callback(retVal);
            } else {
                // subscribe for first data
                let unsub;
                let once;
                const parent = Utils.parentPath(path);
                unsub = this.subscribe(parent, () => {
                    if (!once) {
                        const value = _get(this._data, fullPath);
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
        let obj = this.get(path);
        if (obj) {
            if (this._whitelist) {
                obj = Utils.pickWithKeys(obj, this._whitelist);
            }

            return structuredClone(obj);
        }
        return undefined;
    }

    on(event, fn, prependPath = true) {
        if (!eventsWithoutPrepend.has(event)) {
            event = Utils.fixNumericParts(Utils.concatPath(this._path, event));
        }

        super.on(event, fn);
    }

    whitelist(keySet) {

        if (Array.isArray(keySet)) {
            keySet = new Set(keySet);
        }

        let addedKeys = [];
        let removedKeys = [];
        const existingKeys = this._whitelist || new Set();

        if (this._whitelist) {
            // find added keys
            addedKeys = Array.from(keySet).filter(key => !this._whitelist.has(key));

            // find removed keys
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
                deletions[key] = this.get(key);
                differences[key] = DeleteKeyword
            });

            addedKeys.forEach(key => {
                const val = this.get(key)
                if (val !== undefined) {
                    differences[key] = val;
                    additions[key] = val;
                    hasAdditions = true;
                }
            });


            let path = this._path;
            path = path || '';
            path = Utils.fixNumericParts(path);
            this.emit(PATH_EVENT_PREFIX + path, {differences, hasDifferences: true, hasDeletions, hasAdditions, deletions, additions, changeType: 'whitelist-change'}, {});
            if (this.options.fireGlobalChangeEvents) {
                this.emit('change', {differences, hasDifferences: true, hasDeletions, hasAdditions, deletions, additions, changeType: 'whitelist-change'}, path, {});
            }
        }

        this._whitelist = keySet;
    }


    subscribe (subPath, fn, skipInitial = false) {
        if (typeof subPath === 'function') {
            skipInitial = fn;
            fn = subPath;
            subPath = '';
        }

        const cb = fn;
        let aggregatedPatch;
        let aggregatedChangesInfo;
        let lastOptions;
        let lastTimeout;

        const flush = () => {
            if (!aggregatedPatch) { return; }

            cb(aggregatedPatch, aggregatedChangesInfo, lastOptions.context || {},  true, lastOptions.params);
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
                (lastOptions?.context && !_isEqual(lastOptions.context, options.context));

            if (flushNow) {
                if (aggregatedPatch) {
                    flush();
                }

                cb(patch, changesInfo, options.context || {}, false, options.params);
                return;
            }

            lastOptions = options;
            aggregatedPatch = aggregatedPatch ? aggregate(aggregatedPatch, patch) : patch;
            aggregatedChangesInfo = aggregatedChangesInfo ? aggregate(aggregatedChangesInfo, changesInfo) : changesInfo;
            //fn(delta, diff, options);
            lastTimeout = setTimeout(flush, 0);
        }

        const isPattern = subPath.includes('*') || subPath.includes(':');

        if (!skipInitial) {
            if (isPattern) {
                this.getAll(subPath).forEach(({value, params}) => {
                    fn(value, {snapshot: true}, {...this.options, params});
                });
            } else {
                fn(this.get(subPath), {snapshot: true}, this.options);
            }
        }

        let path = subPath;
        path = Utils.concatPath(this._path, path);
        path = path || '';
        path = Utils.fixNumericParts(path);

        let handler = (diff, options) => {
            fn(diff.differences, diff, options);
        };

        if (this._whitelist) {
            handler = (diff, options) => {
                const delta = Utils.pickWithKeys(diff.differences, this._whitelist);
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
            handler = null;
        };
    }

    getWhenExists(path) {
        return new Promise(resolve => {
            this.get(path, resolve);
        });
    }

    whenAnything(path) {
        return new Promise(resolve => {
            const unsub = this.subscribe(path, data => {
                if (typeof data === 'object' && Object.keys(data).length !== 0) {
                    resolve(data);
                    setTimeout(() => unsub(), 0);
                }
            });
        });
    }

    at(subPath) {

        let path = Utils.concatPath(this._path, subPath);

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

        let at = Object.create(this);
        at._root = this.root;
        at._whitelist = null;
        at._subs = {};
        at._path = Utils.fixNumericParts(path);

        const {wrapper, wrapperInner, lastKey} = Utils.createWrapperWithLastKey(path);

        at._wrapper = wrapper;
        at._wrapperInner = wrapperInner;
        at._wrapperKey = lastKey;

        return at;
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
            levelDiffs = DiffTracker.create(isTargetArray && target.length === 0 && _isArray(patch), options.deletePatch);
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
            let key = keys[i];

            if (Utils.isValid(patch[key]) && (patch[key] !== target[key])) {
                levelDiffs = this._applyAtKey(target, patch, path, key, levelDiffs, options, level, override, isTargetArray);
            }
        }

        // override is either undefined, a path or true
        if ((!_isUndefined(override) && (override === true || path.indexOf(override) === 0)) || (options.overrides && (options.overrides[path]))) {
            // find keys at this level that exists at the target object and remove them
            levelDiffs = this._detectDeletionsAtLevel(target, patch, levelDiffs, path, options, isTargetArray, level);
        }

        if (options.emitEvents && levelDiffs.hasDifferences) {
            this.emit(PATH_EVENT_PREFIX + (path || ''), levelDiffs, options);
            if (options.fireGlobalChangeEvents) {
                this.emit('change', levelDiffs, path, options);
            }
        }

        return levelDiffs;
    }

    _applyAtKey(target, patch, path, key, levelDiffs, options, level, override, isTargetArray) {

        let childDiffs,
            patchValue,
            existingValue,
            srcKey,
            appliedValue, // this value is what goes out to the tracker its not always the same as patchValue
            isExistingValueArray,
            isPatchValueObject = false;

        patchValue = patch[key];
        srcKey = key;

        // splice treat as primitive
        if (key === SpliceKeyword) {
            appliedValue = this._splice(path, patchValue.index, patchValue.itemsToRemove || 0, ...(patchValue.itemsToAdd || []));
            target[srcKey] = patchValue;
            levelDiffs.hasUpdates = true;
            levelDiffs.hasDifferences = true;
            levelDiffs.differences[key] = appliedValue;

            return levelDiffs;
        }

        if (_isFunction(patchValue)) {
            appliedValue = Utils.SERIALIZED_FUNCTION;
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

                    target[srcKey] = patchValue.constructor.call(Object.create(Object.getPrototypeOf(patchValue)));

                    childDiffs = this._applyObject(
                        target[srcKey],
                        patchValue,
                        Utils.pushKeyToPath(path, key, isTargetArray),
                        options,
                        level + 1,
                        override,
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
                    target[srcKey] = patchValue;
                    levelDiffs.additions[key] = appliedValue;
                    levelDiffs.differences[key] = appliedValue;
                    const leafPath =  Utils.pushKeyToPath(path, srcKey, isTargetArray);
                    this.emit(PATH_EVENT_PREFIX + (leafPath || ''),  {differences: appliedValue, additions: appliedValue}, options);
                    if (options.fireGlobalChangeEvents) {
                        this.emit('change', {differences: appliedValue, additions: appliedValue}, leafPath, options);
                    }
                }
            }
            // existing
        } else {

            existingValue = target[srcKey];
            isExistingValueArray = _isArray(existingValue);

            // remove
            if (patch[key] === DeleteKeyword) {
                levelDiffs = this._deleteAtKey(target, path, key, options, existingValue, levelDiffs, isTargetArray);

                // update object
            } else if (isPatchValueObject) {

                // we should replace the target value, todo: array merges check is not sufficient
                if (!isExistingValueArray && !Utils.hasSamePrototype(existingValue, patchValue)) {

                    // this is a restructure
                    // handle prototypes
                    target[srcKey] = Object.create(this._getPrototypeOf(patchValue));

                }

                childDiffs = this._applyObject(target[srcKey],
                    patchValue,
                    Utils.pushKeyToPath(path, key, isTargetArray),
                    options,
                    level + 1,
                    override);

                levelDiffs.addChildTracking(childDiffs, key);

                // update primitive
            } else {

                target[srcKey] = patchValue;

                const updates = {
                    oldVal: existingValue,
                    newVal: appliedValue
                };

                levelDiffs.hasUpdates = true;
                levelDiffs.hasDifferences = true;
                levelDiffs.updates[key] = updates;
                levelDiffs.differences[key] = appliedValue;
                const leafPath =  Utils.pushKeyToPath(path, srcKey, isTargetArray);
                //this.emit(PATH_EVENT_PREFIX + (leafPath || ''),  {differences: appliedValue}, {...options, type: 'update', oldValue: existingValue});
                this.emit(PATH_EVENT_PREFIX + (leafPath || ''),  {differences: appliedValue, updates} , options);
                if (options.fireGlobalChangeEvents) {
                    this.emit('change', {differences: appliedValue, updates}, leafPath, options);
                }
            }

        }

        return levelDiffs;
    }

    _deleteAtKey(target, path, key, options, existingValue, levelDiffs, isArray) {
        if (isArray) {
            target.splice(index(key, levelDiffs), 1);
            levelDiffs.arrayOffset = (levelDiffs.arrayOffset || 0) -1;
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
            const childDiffs = this._emitInnerDeletions(Utils.pushKeyToPath(path, key, isArray), existingValue, options);
            levelDiffs.addChildTracking(childDiffs, key);
        }

        const eventPath = Utils.pushKeyToPath(path, key) || '';
        this.emit(PATH_EVENT_PREFIX + eventPath,  {
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

    _detectDeletionsAtLevel(target, patch, levelDiffs, path, options, isArray) {
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
                this._deleteAtKey(target, path, key, options, existingValue, levelDiffs, isArray);
            }
            else if (typeof patch[key] === 'object') {
                const diffs = DiffTracker.create(_isArray(target[key]) && target[key].length === 0 && _isArray(patch[key]), options.deletePatch);
                this._detectDeletionsAtLevel(target[key], patch[key], diffs, Utils.pushKeyToPath(path, key, isArray), options, Array.isArray(target[key]));
                levelDiffs.addChildTracking(diffs, key);
            }

        }

        return levelDiffs;
    }

    _splice(path, index, itemsToRemove, ...itemsToAdd) {
        const target = this.get(path);
        if (!_isArray(target)) {
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
        let levelDiffs,
            childDiffs;

        if (!_isObject(deletedObject)) {
            return;
        }

        levelDiffs = DiffTracker.create(false, options.deletePatch);
        levelDiffs.path = path;

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

        /*
        let keys = _keys(deletedObject);
        const isArray = _isArray(deletedObject);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            const innerPath = Utils.pushKeyToPath(path, key, isArray);

            if (_isObject(deletedObject[key])) {
                childDiffs = this._emitInnerDeletions(innerPath, deletedObject[key], options);
                levelDiffs.addChildTracking(childDiffs, key);
                this.emit(PATH_EVENT_PREFIX + innerPath, childDiffs, options);
                if (options.fireGlobalChangeEvents) {
                    this.emit('change', childDiffs, innerPath, options);
                }
            } else {
                this.emit(PATH_EVENT_PREFIX + (innerPath || ''),  {differences: DeleteKeyword, deletions: deletedObject[key]}, options);
                if (options.fireGlobalChangeEvents) {
                    this.emit('change', {differences: DeleteKeyword, deletions: deletedObject[key]}, innerPath, options);
                }
            }

            levelDiffs.differences[key] = DeleteKeyword;
        }
*/

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

    getData({immediateFlush} = {}) {
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

PatchDiff.prototype.override = PatchDiff.prototype.set;

PatchDiff.prototype.merge = PatchDiff.prototype.apply;
PatchDiff.prototype.patch = PatchDiff.prototype.apply;

PatchDiff.prototype.scope = PatchDiff.prototype.at;

export default PatchDiff;