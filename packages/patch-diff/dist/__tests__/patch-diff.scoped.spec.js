"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const patch_diff_1 = __importDefault(require("../src/patch-diff"));
describe('Scoped usage', () => {
    describe('scoped mutations', () => {
        describe('apply', () => {
            it('should notify of object change with apply on path', async () => {
                //Arrange
                const scoped = new patch_diff_1.default({ a: { b: { c: 'd' } } }).at('a.b');
                const spy = jest.fn();
                const isAggregated = false;
                // @ts-expect-error
                scoped.subscribe('c', (diff, changeInfo, context, isAggregated) => {
                    console.log('c', diff, changeInfo, context, isAggregated);
                    spy(diff, changeInfo, context, isAggregated);
                });
                expect(spy).toHaveBeenCalledWith('d', { snapshot: true }, {}, isAggregated);
                //Act
                scoped.apply({ e: 'f' }, 'c');
                //Assert
                expect(scoped.get()).toEqual({ c: { e: 'f' } });
                expect(spy).toHaveBeenCalledWith({ e: 'f' }, expect.objectContaining({ addedObjects: {}, additions: { e: "f" }, deletions: {}, differences: { e: "f" }, hasAddedObjects: false, hasAdditions: true, hasDeletions: false, hasDifferences: true, hasUpdates: false, "path": "a.b.c", "updates": {} }), {}, isAggregated);
            });
            it('should notify of object change with apply on self (without path)', () => {
                //Arrange
                const scoped = new patch_diff_1.default({ a: { b: { c: 'd' } } }).at('a.b');
                ;
                const spy = jest.fn();
                const isAggregated = false;
                // @ts-expect-error
                scoped.subscribe('c', (diff, changeInfo, context, isAggregated) => {
                    console.log('scoped a.b', diff, changeInfo, context, isAggregated);
                    spy(diff, changeInfo, context, isAggregated);
                });
                expect(spy).toHaveBeenCalledWith('d', { snapshot: true }, {}, isAggregated);
                //Act
                scoped.apply({ c: { e: 'f' } });
                //Assert
                expect(scoped.get()).toEqual({ c: { e: 'f' } });
                expect(spy).toHaveBeenCalledWith({ e: 'f' }, expect.objectContaining({ "addedObjects": {}, "additions": { "e": "f" }, "deletions": {}, "differences": { "e": "f" }, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": false, "hasDifferences": true, "hasUpdates": false, "path": "a.b.c", "updates": {} }), {}, isAggregated);
            });
            it('should notify of all object changes with apply when patch, deletion and override are used', () => {
                //Arrange
                const scoped = new patch_diff_1.default({ a: { b: { c: 'd', e: 'f', g: { h: 'i', j: 'k' } } } }).at('a.b');
                const overrides = { 'a.b.c.g': true };
                const spy = jest.fn();
                const isAggregated = false;
                // @ts-expect-error
                scoped.subscribe((diff, changeInfo, context, isAggregated) => {
                    console.log('scoped a.b', diff, changeInfo, context, isAggregated);
                    spy(diff, changeInfo, context, isAggregated);
                });
                expect(spy).toHaveBeenCalledWith({ c: 'd', e: 'f', g: { h: 'i', j: 'k' } }, { snapshot: true }, {}, isAggregated);
                //Act
                scoped.apply({ e: 'patch', c: scoped.options.deleteKeyword, g: 5 }, '', { overrides });
                //Assert
                expect(scoped.get()).toEqual({ e: 'patch', g: 5 });
                expect(spy).toHaveBeenCalledWith({ c: scoped.options.deleteKeyword, e: 'patch', g: 5 }, expect.objectContaining({ "addedObjects": {}, "additions": {}, "deletions": { "c": "d" }, "differences": { "c": "__$$D", "e": "patch", "g": 5 }, "hasAddedObjects": false, "hasAdditions": false, "hasDeletions": true, "hasDifferences": true, "hasUpdates": true, "path": "a.b", "updates": { "e": { "newVal": "patch", "oldVal": "f" }, "g": { "newVal": 5, "oldVal": { "h": "i", "j": "k" } } } }), {}, isAggregated);
            });
        });
        describe('set', () => {
            it('should notify of object change with set on path', async () => {
                //Arrange
                const scoped = new patch_diff_1.default({ a: { b: { c: 'd' } } }).at('a.b');
                const spy = jest.fn();
                const isAggregated = false;
                // @ts-expect-error
                scoped.subscribe((diff, changeInfo, context, isAggregated) => {
                    console.log('scoped a.b', diff, changeInfo, context, isAggregated);
                    spy(diff, changeInfo, context, isAggregated);
                });
                expect(spy).toHaveBeenCalledWith({ c: 'd' }, { snapshot: true }, {}, isAggregated);
                //Act
                scoped.set({ e: 'f' }, 'c');
                //Assert
                expect(scoped.get()).toEqual({ c: { e: 'f' } });
                expect(spy).toHaveBeenCalledWith({ c: { e: 'f' } }, expect.objectContaining({ "addedObjects": {}, "additions": { c: { e: "f" } }, "deletions": {}, "differences": { "c": { "e": "f" } }, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": false, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {} }), {}, isAggregated);
            });
            it('should notify of object change with set on self (without path)', () => {
                //Arrange
                const scoped = new patch_diff_1.default({ a: { b: { c: 'd' } } }).at('a');
                const spy = jest.fn();
                const isAggregated = false;
                // @ts-expect-error
                scoped.subscribe('b', (diff, changeInfo, context, isAggregated) => {
                    console.log('scoped a subscribed b', diff, changeInfo, context, isAggregated);
                    spy(diff, changeInfo, context, isAggregated);
                });
                expect(spy).toHaveBeenCalledWith({ c: 'd' }, { snapshot: true }, {}, isAggregated);
                //Act
                scoped.set({ b: { e: 'f' } });
                //Assert
                expect(scoped.get()).toEqual({ b: { e: 'f' } });
                expect(spy).toHaveBeenCalledWith({ c: '__$$D', e: 'f' }, expect.objectContaining({ "addedObjects": {}, "additions": { "e": "f" }, "deletions": { c: 'd' }, "differences": { "c": "__$$D", "e": "f" }, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {} }), {}, isAggregated);
            });
        });
        describe('remove', () => {
            it('should notify of object change with remove on path', async () => {
                //Arrange
                const scoped = new patch_diff_1.default({ a: { b: { c: 'd' } } }).at('a.b');
                const spy = jest.fn();
                const isAggregated = false;
                //Act
                // @ts-expect-error
                scoped.subscribe('c', (diff, changeInfo, context, isAggregated) => {
                    console.log('scoped a.b subscribe c', diff, changeInfo, context, isAggregated);
                    spy(diff, changeInfo, context, isAggregated);
                });
                scoped.remove('c');
                //Assert
                expect(spy).toHaveBeenCalledWith('d', { snapshot: true }, {}, isAggregated);
                expect(scoped.get()).toEqual({});
                expect(spy).toHaveBeenCalledWith('__$$D', expect.objectContaining({ "deletions": 'd', "differences": '__$$D', "hasAddedObjects": false, "hasAdditions": false, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false }), {}, isAggregated);
            });
            it.failing('should notify of object change with remove on self (without path)', () => {
                //Arrange
                const scoped = new patch_diff_1.default({ a: { b: { c: 'd' } } }).at('a.b');
                const spy = jest.fn();
                const isAggregated = false;
                // @ts-expect-error
                scoped.subscribe('c', (diff, changeInfo, context, isAggregated) => {
                    console.log('scoped a.b subscribe c', diff, changeInfo, context, isAggregated);
                    spy(diff, changeInfo, context, isAggregated);
                });
                expect(spy).toHaveBeenCalledWith('d', { snapshot: true }, {}, isAggregated);
                //Act
                scoped.remove();
                //Assert
                // scoped.get() === undefined, for consistency with remove on root, should be {}?
                expect(scoped.get()).toEqual({});
                // we do get a notification on delete
                // we have deletions and differences but 'hasDeletions' and 'hasDifferences' are not present
                expect(spy).toHaveBeenCalledWith(scoped.options.deleteKeyword, expect.objectContaining({ deletions: 'd', differences: '__$$D', hasDeletions: true, hasDifferences: true }), {}, isAggregated);
            });
        });
    });
    describe('root <-> scope notifications', () => {
        //subscribe on scope and mutate from root
        it('should notify scoped patcher when mutated from root', () => {
            //Arrange
            const patcher = new patch_diff_1.default({ a: { b: { c: 'd' } } });
            const spy = jest.fn();
            const isAggregated = false;
            const scoped = patcher.at('a.b');
            // @ts-expect-error
            scoped.subscribe((diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            expect(spy).toHaveBeenCalledWith({ c: 'd' }, { snapshot: true }, {}, isAggregated);
            //Act
            patcher.apply({ e: 'f' }, 'a.b');
            //Assert
            expect(scoped.get()).toEqual({ c: 'd', e: 'f' });
            expect(spy).toHaveBeenCalledWith({ e: 'f' }, expect.objectContaining({ "addedObjects": {}, "additions": { "e": "f" }, "deletions": {}, "differences": { "e": "f" }, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": false, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {} }), {}, isAggregated);
        });
        //subscribe on root and mutate at scope
        it('should notify root patcher when mutated at scoped patcher', () => {
            //Arrange
            const patcher = new patch_diff_1.default({ a: { b: { c: 'd' } } });
            const spy = jest.fn();
            const isAggregated = false;
            const scoped = patcher.at('a.b');
            // @ts-expect-error
            patcher.subscribe((diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            expect(spy).toHaveBeenCalledWith({ a: { b: { c: 'd' } } }, { snapshot: true }, {}, isAggregated);
            //Act
            scoped.apply({ e: 'f' });
            //Assert
            expect(scoped.get()).toEqual({ c: 'd', e: 'f' });
            expect(spy).toHaveBeenCalledWith({ a: { b: { e: 'f' } } }, expect.objectContaining({ "addedObjects": {}, "additions": { a: { b: { e: 'f' } } }, "deletions": {}, "differences": { a: { b: { e: 'f' } } }, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": false, "hasDifferences": true, "hasUpdates": false, "path": "", "updates": {} }), {}, isAggregated);
        });
        //subscribe on scope and mutate at root
        it('should not notify scoped patcher when mutated on root', () => {
            //Arrange
            const patcher = new patch_diff_1.default({ a: { b: { c: 'd' } } });
            const spy = jest.fn();
            const isAggregated = false;
            const scoped = patcher.at('a.b');
            // @ts-expect-error
            scoped.subscribe((diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            //Act
            patcher.apply({ e: 'f' }, 'a');
            //Assert
            expect(scoped.get()).toEqual({ c: 'd' });
            expect(patcher.get()).toEqual({ a: { b: { c: 'd' }, e: 'f' } });
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith({ c: 'd' }, { snapshot: true }, {}, isAggregated);
        });
        //subscribe on scope and mutate on scope
        it('should notify scoped patcher when mutated', () => {
            //Arrange
            const patcher = new patch_diff_1.default({ a: { b: { c: 'd' } } });
            const spy = jest.fn();
            const isAggregated = false;
            const scoped = patcher.at('a.b');
            // @ts-expect-error
            scoped.subscribe((diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            expect(spy).toHaveBeenCalledWith({ c: 'd' }, { snapshot: true }, {}, isAggregated);
            //Act
            scoped.apply({ e: 'f' });
            //Assert
            expect(scoped.get()).toEqual({ c: 'd', e: 'f' });
            expect(spy).toHaveBeenCalledWith({ e: 'f' }, expect.objectContaining({ "addedObjects": {}, "additions": { "e": "f" }, "deletions": {}, "differences": { "e": "f" }, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": false, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {} }), {}, isAggregated);
        });
    });
});
//# sourceMappingURL=patch-diff.scoped.spec.js.map