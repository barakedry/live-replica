import { EventEmitter } from '../../events/events.js';
import { Utils } from '../../utils/utils.js';
import { DiffTracker } from "./diff-tracker.js";

const debug = (msg) => {};

import _defaults from '../../../node_modules/lodash-es/defaults.js';
import _isObject from '../../../node_modules/lodash-es/isObject.js';
import _isString from '../../../node_modules/lodash-es/isString.js';
import _get from '../../../node_modules/lodash-es/get.js';
import _keys from '../../../node_modules/lodash-es/keys.js';
import _isArray from '../../../node_modules/lodash-es/isArray.js';
import _isUndefined from '../../../node_modules/lodash-es/isUndefined.js';
import _isFunction from '../../../node_modules/lodash-es/isFunction.js';

function index(key, levelDiffs) {
    return Number(key) + (levelDiffs.arrayOffset || 0);
}

export class PatchDiff extends EventEmitter {
    constructor(object, options) {

        super();

        this.options = _defaults(options || {}, {
            emitEvents: true, //settings this to false should allow faster merging but it is not implemented yet
            undefinedKeyword: '__$$U',
            deleteKeyword: '__$$D',
            spliceKeyword: '__$$S',
            protoKeyword: '__$$P',
            patchDeletions: true,
            patchAdditions: true,
            emitAdditions: true,
            emitUpdates: true,
            emitDifferences: true,
            maxKeysInLevel: 1000,
            maxLevels: 50,
            maxListeners: 1000000,
            disableSplices: true
        });

        this.retainState = true;
        this._data = object || {};
        this.setMaxListeners(this.options.maxListeners);
        //this.prototypes = []; // prototypes are stored in a special collection
    }

    apply(patch, path, options) {

        path = Utils.concatPath(this._path, path);
        options = _defaults(options || {}, this.options);

        if (!_isObject(patch) && !path) {
            debug('invalid apply, target and patch must be objects');

            return;
        }

        this._applyObject(this._data, Utils.wrapByPath(patch, path), '', options, 0);
    }

    set(fullDocument, path, options) {

        path = Utils.concatPath(this._path, path);

        options = _defaults(options || {}, this.options);

        if (!_isObject(fullDocument) && !path) {
            debug('invalid apply, target and value must be objects');

            return;
        }

        this._applyObject(this._data, Utils.wrapByPath(fullDocument, path), '', options, 0, path || true);
    }

    remove(path, options) {

        path = Utils.concatPath(this._path, path);

        options = _defaults(options || {}, this.options);

        if (!(path && _isString(path))) {
            debug('invalid path, cannot remove');

            return;
        }

        this._applyObject(this._data, Utils.wrapByPath(this.options.deleteKeyword, path), '', options, 0);
    }

    splice({index, itemsToRemove, ...itemsToAdd}, path, options = {}) {
        options = _defaults(options || {}, this.options);
        path = Utils.concatPath(this._path, path);
        this._applyObject(this._data, Utils.wrapByPath({[this.options.spliceKeyword]: {index, itemsToRemove, itemsToAdd}}, path), '', options, 0);
    }

    get(path, callback) {

        if (typeof path === 'function') {
            callback = path;
            path = undefined;
        }

        const fullPath = Utils.concatPath(this._path, path);
        if (fullPath && (!_isString(fullPath))) {
            debug('invalid path, cannot get');

            return;
        }


        let retVal;
        if (fullPath) {
            retVal = _get(this._data, fullPath);
        } else {
            retVal = this._data;
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
        const obj = this.get(path);
        if (obj) {
            return JSON.parse(JSON.stringify(obj));
        }
        return undefined;
    }

    on(path, fn) {
        path = Utils.concatPath(this._path, path);
        super.on(path, fn);
    }

    subscribe (path, fn) {
        if (typeof path === 'function') {
            fn = path;
            path = '';
        }

        let current = this.get(path);
        if (current) {
            fn(current, {snapshot: true}, {});
        }

        path = Utils.concatPath(this._path, path);
        path = path || '*';

        if (path !== "" && !isNaN(path)) {
            path = `[${path}]`
        }

        let handler = function (diff, options) {
            if (this.retainState === false) {
                fn(current, {snapshot: true}, {});
            } else {
                fn(diff.differences, diff, options);
            }

        };
        super.on(path, handler);

        return () => {
            if (!handler) { return; }
            this.removeListener(path, handler);
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
        let at = Object.create(this);
        at._path = path;

        return at;
    }


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

        if (this.retainState && !(_isObject(target) && _isObject(patch))) {
            debug('invalid apply, target and patch must be objects');
            this.emit('error', new Error('invalid apply, target and patch must be objects'));

            return;
        }

        if (level > options.maxLevels) {
            debug('Trying to apply too deep, stopping at level %d', level);
            this.emit('error', new Error('Trying to apply too deep, stopping at level ' + level));

            return;
        }

        let levelDiffs;
        let keys = _keys(patch);
        let length = keys.length;
        let isTargetArray = _isArray(target);

        if (options.emitEvents) {
            levelDiffs = DiffTracker.create(isTargetArray && target.length === 0 && _isArray(patch));
            levelDiffs.path = path;
        }

        if (isTargetArray) {
            levelDiffs = levelDiffs || {};
        }

        if (length > options.maxKeysInLevel) {
            debug('Stopped patching, Too many keys in object - %d out of %d allowed keys.', length, options.maxKeysInLevel);
            this.emit('error', new Error('Stopped patching, Too many keys in object - ' + length + ' out of ' + options.maxKeysInLevel + ' allowed keys.'));

            return levelDiffs;
        }

        // main logic loop, iterate patch keys and apply to dest object
        for (let i = 0; i < length; i++) {
            let key = keys[i];

            if (Utils.isValid(patch[key]) && (!this.retainState || patch[key] !== target[key])) {
                levelDiffs = this._applyAtKey(target, patch, path, key, levelDiffs, options, level, override, isTargetArray);
            }
        }

        // override is either undefined, a path or true
        if ((!_isUndefined(override) && (override === true || path.indexOf(override) === 0)) || (options.overrides && (options.overrides[path]))) {
            // find keys at this level that exists at the target object and remove them
            levelDiffs = this._detectDeletionsAtLevel(target, patch, levelDiffs, path, options, isTargetArray, level);
        }

        if (options.emitEvents && levelDiffs.hasDifferences) {
            this.emit((path || '*'), levelDiffs, options);
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
        if (key === this.options.spliceKeyword) {
            appliedValue = this._splice(path, patchValue.index, patchValue.itemsToRemove || 0, ...(patchValue.itemsToAdd || []));
            if (this.retainState) {
                target[srcKey] = patchValue;
            }


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
                appliedValue = options.undefinedKeyword;
            } else if (patchValue === options.undefinedKeyword) {
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
        if (!this.retainState || !target.hasOwnProperty(srcKey)) {
            if (options.patchAdditions && patch[key] !== options.deleteKeyword) {

                levelDiffs.hasAdditions = true;
                levelDiffs.hasDifferences = true;


                // add new object
                if (isPatchValueObject) {

                    if (this.retainState) {
                        target[srcKey] = patchValue.constructor.call(Object.create(Object.getPrototypeOf(patchValue)));
                    }

                    childDiffs = this._applyObject(this.retainState ? target[srcKey] : undefined,
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
                    if (this.retainState) {
                        target[srcKey] = patchValue;
                    }

                    levelDiffs.additions[key] = appliedValue;
                    levelDiffs.differences[key] = appliedValue;
                    const leafPath =  Utils.pushKeyToPath(path, srcKey, isTargetArray);
                    this.emit((leafPath || '*'),  appliedValue, {type: 'addition',});
                }
            }
        // existing
        } else {

            existingValue = target[srcKey];
            isExistingValueArray = _isArray(existingValue);

            // remove
            if (patch[key] === options.deleteKeyword) {
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

                levelDiffs.hasUpdates = true;
                levelDiffs.hasDifferences = true;
                levelDiffs.updates[key] = {
                    oldVal: existingValue,
                    newVal: appliedValue
                };
                levelDiffs.differences[key] = appliedValue;
                const leafPath =  Utils.pushKeyToPath(path, srcKey, isTargetArray);
                this.emit((leafPath || '*'),  appliedValue, {type: 'update', oldValue: existingValue});
            }

        }

        return levelDiffs;
    }

    _deleteAtKey(target, path, key, options, existingValue, levelDiffs, isArray) {
        if (options.patchDeletions) {

            if (isArray) {
                target.splice(index(key, levelDiffs), 1);
                levelDiffs.arrayOffset = (levelDiffs.arrayOffset || 0) -1;
            } else {
                delete target[key];
            }

        }

        levelDiffs.deletions[key] = existingValue;
        levelDiffs.differences[key] = options.deleteKeyword;
        levelDiffs.hasDeletions = true;
        levelDiffs.hasDifferences = true;

        if (_isObject(existingValue)) {
            //levelDiffs.addChildTracking(this._emitInnerDeletions(path, existingValue, options), key)
            const childDiffs = this._emitInnerDeletions(Utils.pushKeyToPath(path, key, isArray), existingValue, options);
            this.emit(Utils.pushKeyToPath(path, key), childDiffs);
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

            if (!patch.hasOwnProperty(key)) {
                existingValue = target[key];
                this._deleteAtKey(target, path, key, options, existingValue, levelDiffs, isArray);
            }
            else if (typeof patch[key] === 'object') {
                const diffs = DiffTracker.create(_isArray(target[key]) && target[key].length === 0 && _isArray(patch[key]));
                this._detectDeletionsAtLevel(target[key], patch[key], diffs, Utils.pushKeyToPath(path, key, isArray), options, Array.isArray(target[key]));
                levelDiffs.addChildTracking(diffs, key);
            }

        }

        return levelDiffs;
    }

    _splice(path, index, itemsToRemove, ...itemsToAdd) {
        const target = this.get(path);
        if (!_isArray(target)) {
            debug('invalid splice, target must be an array');

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

        if (options.emitEvents) {
            levelDiffs = DiffTracker.create();
            levelDiffs.path = path;
        }

        let keys = _keys(deletedObject);
        const isArray = _isArray(deletedObject);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (_isObject(deletedObject[key])) {
                const innerPath = Utils.pushKeyToPath(path, key, isArray);
                childDiffs = this._emitInnerDeletions(innerPath, deletedObject[key], options);
                levelDiffs.addChildTracking(childDiffs, key);
                this.emit(innerPath, childDiffs);
            }

            levelDiffs.differences[key] = options.deleteKeyword;
        }

        levelDiffs.hasDeletions = true;
        levelDiffs.hasDifferences = true;
        levelDiffs.deletions = deletedObject;
        return levelDiffs;
    }
}

PatchDiff.prototype.observe = EventEmitter.prototype.on;
PatchDiff.prototype.override = PatchDiff.prototype.set;

export default PatchDiff;