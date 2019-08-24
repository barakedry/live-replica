/**
 * Created by barakedry on 6/19/15.
 */
/* eslint max-params: 'off' */
'use strict';

// import {EventEmitter} from 'events';
// import _ from 'lodash';
// import utils from './utils';
// import DiffTracker from './diff-tracker';
// import debuglog from 'debuglog'
// const debug = debuglog('patch-diff');

const {EventEmitter} = require('events');
const _ = require('lodash');
const utils = require('./utils');
const DiffTracker = require('./diff-tracker');
const debuglog = require('debuglog');
const debug = debuglog('patch-diff');

function index(key, levelDiffs) {
    return Number(key) - (levelDiffs.arrayOffset || 0);
}

class PatchDiff extends EventEmitter {
    constructor(object, options) {

        super();

        this.options = _.defaults(options || {}, {
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
            maxListeners: 1000000
        });

        this._data = object || {};
        this.setMaxListeners(this.options.maxListeners);
        //this.prototypes = []; // prototypes are stored in a special collection
    }

    apply(patch, path, options) {

        path = utils.concatPath(this._path, path);
        options = _.defaults(options || {}, this.options);

        if (!_.isObject(patch) && !path) {
            debug('invalid apply, target and patch must be objects');

            return;
        }

        this._applyObject(this._data, utils.wrapByPath(patch, path), '', options, 0);
    }

    set(fullDocument, path, options) {

        path = utils.concatPath(this._path, path);

        options = _.defaults(options || {}, this.options);

        if (!_.isObject(fullDocument) && !path) {
            debug('invalid apply, target and value must be objects');

            return;
        }

        this._applyObject(this._data, utils.wrapByPath(fullDocument, path), '', options, 0, path || true);
    }

    remove(path, options) {

        path = utils.concatPath(this._path, path);

        options = _.defaults(options || {}, this.options);

        if (!(path && _.isString(path))) {
            debug('invalid path, cannot remove');

            return;
        }

        this._applyObject(this._data, utils.wrapByPath(this.options.deleteKeyword, path), '', options, 0);
    }

    splice(path, {index, itemsToRemove, ...itemsToAdd}, options = {}) {
        options = _.defaults(options || {}, this.options);
        path = utils.concatPath(this._path, path);
        this._applyObject(this._data, utils.wrapByPath({[this.options.spliceKeyword]: {index, itemsToRemove, itemsToAdd}}, path), '', options, 0);
    }

    get(path, callback) {

        if (typeof path === 'function') {
            callback = path;
            path = undefined;
        }

        const fullPath = utils.concatPath(this._path, path);
        if (fullPath && (!_.isString(fullPath))) {
            debug('invalid path, cannot get');

            return;
        }


        let retVal;
        if (fullPath) {
            retVal = _.get(this._data, fullPath);
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
                const parent = path.substring(0, path.lastIndexOf('.'));
                unsub = this.subscribe(parent, () => {
                    if (!once) {
                        const value = _.get(this._data, fullPath);
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
        path = utils.concatPath(this._path, path);
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

        path = utils.concatPath(this._path, path);
        path = path || '*';

        let handler = function (diff, options) {
            fn(diff.differences, diff, options);
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
        let path = utils.concatPath(this._path, subPath);
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

        if (!(_.isObject(target) && _.isObject(patch))) {
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
        let keys = _.keys(patch);
        let length = keys.length;
        let isTargetArray = _.isArray(target);

        if (options.emitEvents) {
            levelDiffs = DiffTracker.create(isTargetArray && target.length === 0 && _.isArray(patch));
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

            if (utils.isValid(patch[key]) && patch[key] !== target[key]) {
                levelDiffs = this._applyAtKey(target, patch, path, key, levelDiffs, options, level, override, isTargetArray);
            }
        }

        // override is either undefined, a path or true
        if ((!_.isUndefined(override) && (override === true || path.indexOf(override) === 0)) || (options.overrides && (options.overrides[path]))) {
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
            target[srcKey] = patchValue;

            levelDiffs.hasUpdates = true;
            levelDiffs.hasDifferences = true;
            levelDiffs.differences[key] = appliedValue;
            return levelDiffs;
        }

        if (_.isFunction(patchValue)) {
            appliedValue = utils.SERIALIZED_FUNCTION;
        } else {
            isPatchValueObject = _.isObject(patchValue);
            if (_.isUndefined(patchValue)) {
                appliedValue = options.undefinedKeyword;
            } else if (patchValue === options.undefinedKeyword) {
                appliedValue = patchValue;
                patchValue = undefined;
            } else {
                appliedValue = patchValue;
            }
        }

        // new
        if (!target.hasOwnProperty(srcKey)) {
            if (options.patchAdditions && patch[key] !== options.deleteKeyword) {

                levelDiffs.hasAdditions = true;
                levelDiffs.hasDifferences = true;


                // add new object
                if (isPatchValueObject) {

                    if (isTargetArray) {
                        srcKey = index(srcKey, levelDiffs);
                    }

                    target[srcKey] = patchValue.constructor.call(Object.create(Object.getPrototypeOf(patchValue)));

                    childDiffs = this._applyObject(target[srcKey],
                        patchValue,
                        utils.concatPath(path, key),
                        options,
                        level + 1,
                        override,
                        isTargetArray
                    );

                    levelDiffs.addChildTracking(childDiffs, key);

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
                }
            }
        // existing
        } else {

            existingValue = target[srcKey];
            isExistingValueArray = _.isArray(existingValue);

            // remove
            if (patch[key] === options.deleteKeyword) {
                levelDiffs = this._deleteAtKey(target, path, key, options, existingValue, levelDiffs, isTargetArray);

            // update object
            } else if (isPatchValueObject) {

                // we should replace the target value, todo: array merges check is not sufficient
                if (!isExistingValueArray && !utils.hasSamePrototype(existingValue, patchValue)) {

                    // this is a restructure
                    // handle prototypes
                    target[srcKey] = Object.create(this._getPrototypeOf(patchValue));

                }

                childDiffs = this._applyObject(target[srcKey],
                    patchValue,
                    utils.concatPath(path, key),
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

        if (_.isObject(existingValue)) {
            //levelDiffs.addChildTracking(this._emitInnerDeletions(path, existingValue, options), key)
            this._emitInnerDeletions(path, existingValue, options);
        }

        return levelDiffs;
    }

    _detectDeletionsAtLevel(target, patch, levelDiffs, path, options, isArray) {
        const keys = _.keys(target),
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

            // else if (typeof patch[key] === 'object') {
            //
            //     const diffs = DiffTracker.create(_.isArray(patch[key]));
            //     this._detectDeletionsAtLevel(target[key], patch[key], diffs, [path, key].join('.'), options, Array.isArray(target[key]));
            //     levelDiffs.addChildTracking(diffs, key);
            // }

        }

        return levelDiffs;
    }

    _splice(path, index, itemsToRemove, ...itemsToAdd) {
        const target = this.get(path);
        if (!_.isArray(target)) {
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

        if (!_.isObject(deletedObject)) {
            return;
        }

        if (options.emitEvents) {
            levelDiffs = DiffTracker.create();
            levelDiffs.path = path;
        }

        let keys = _.keys(deletedObject);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (_.isObject(deletedObject[key])) {
                childDiffs = this._emitInnerDeletions(utils.concatPath(path, key), deletedObject[key], options);
                levelDiffs.addChildTracking(childDiffs, key);
            } else {
                levelDiffs.differences[key] = options.deleteKeyword;
            }

        }

        levelDiffs.hasDeletions = true;
        levelDiffs.hasDifferences = true;
        levelDiffs.deletions = deletedObject;

        this.emit((path || '*'), levelDiffs, options);

        return levelDiffs;
    }

    _emitFrom(path, diff) {

        if (!path) {
            this.emit('*', diff);

            return;
        }

        let pindex = path.lastIndexOf('.');
        while (pindex > 0) {
            const key = path.substring(pindex + 1);
            path = path.substring(0, pindex);
            diff = { [key]: diff };
            this.emit(path, diff);

            pindex = path.lastIndexOf('.');
        }
        this.emit('*', { [path]: diff });
    }
}

PatchDiff.prototype.observe = EventEmitter.prototype.on;
PatchDiff.prototype.override = PatchDiff.prototype.set;
PatchDiff.utils = utils;

//export default PatchDiff;
module.exports = PatchDiff;
