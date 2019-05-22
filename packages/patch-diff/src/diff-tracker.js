/**
 * Created by barakedry on 6/20/15.
 */
'use strict';

function deepAssign(target, patch) {
    const keys = Object.keys(patch);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (target.hasOwnProperty(key) && typeof target[key] === 'object') {
            deepAssign(target[key], patch[key]);
        } else {
            target[key] = patch[key];
        }
    }

    return target;
}

function create(diffsAsArray) {
    return {
        hasAdditions: false,
        hasDeletions: false,
        hasUpdates: false,
        hasDifferences: false,
        additions: diffsAsArray ? [] : {},
        deletions: {},
        updates: {},
        differences: diffsAsArray ? [] : {},
        addChildTracking: function addChildTracking(childTracker, key) {
            if (childTracker.hasAdditions) {
                this.additions[key] = childTracker.additions;
                this.hasAdditions = true;
            }

            if (childTracker.hasDeletions) {
                this.deletions[key] = childTracker.deletions;
                this.hasDeletions = true;
            }

            if (childTracker.hasUpdates) {
                this.updates[key] = childTracker.updates;
                this.hasUpdates = true;
            }

            if (childTracker.hasDifferences) {
                if (this.differences.hasOwnProperty(key) && typeof this.differences[key] === 'object') {
                    deepAssign(this.differences[key], childTracker.differences);
                } else {
                    this.differences[key] = childTracker.differences;
                }

                this.hasDifferences = true;
            }
        }
    };
}

module.exports = {create};