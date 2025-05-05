"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffTracker = void 0;
function deepAssign(target, patch) {
    const keys = Object.keys(patch);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (target.hasOwnProperty(key) && typeof target[key] === 'object') {
            deepAssign(target[key], patch[key]);
        }
        else {
            target[key] = patch[key];
        }
    }
    return target;
}
function create(diffsAsArray, deletePatch = false) {
    return {
        hasAdditions: false,
        hasAddedObjects: false,
        hasDeletions: false,
        hasUpdates: false,
        hasDifferences: false,
        additions: diffsAsArray ? [] : {},
        deletions: {},
        updates: {},
        addedObjects: {},
        differences: diffsAsArray ? [] : {},
        deletePatch,
        addChildTracking: function addChildTracking(childTracker, key, isNewObject = false) {
            if (childTracker.hasAdditions) {
                // @ts-expect-error: dynamic key assignment
                this.additions[key] = childTracker.additions;
                this.hasAdditions = true;
            }
            if (isNewObject && childTracker.hasDifferences) {
                // @ts-expect-error: dynamic key assignment
                this.addedObjects[key] = true;
                this.hasAddedObjects = true;
            }
            else if (childTracker.hasAddedObjects) {
                // @ts-expect-error: dynamic key assignment
                this.addedObjects[key] = childTracker.addedObjects;
                this.hasAddedObjects = true;
            }
            if (childTracker.hasDeletions) {
                // @ts-expect-error: dynamic key assignment
                this.deletions[key] = childTracker.deletions;
                this.hasDeletions = true;
            }
            if (childTracker.hasUpdates) {
                // @ts-expect-error: dynamic key assignment
                this.updates[key] = childTracker.updates;
                this.hasUpdates = true;
            }
            if (childTracker.hasDifferences) {
                // @ts-expect-error: dynamic key assignment
                if (this.differences.hasOwnProperty(key) && typeof this.differences[key] === 'object') {
                    // @ts-expect-error: dynamic key assignment
                    deepAssign(this.differences[key], childTracker.differences);
                }
                else if (!this.differences.hasOwnProperty(key)) {
                    // @ts-expect-error: dynamic key assignment
                    this.differences[key] = childTracker.differences;
                }
                this.hasDifferences = true;
            }
        }
    };
}
exports.DiffTracker = { create };
//# sourceMappingURL=diff-tracker.js.map