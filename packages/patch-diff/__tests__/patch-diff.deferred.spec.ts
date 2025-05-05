import PatchDiff from "../src/patch-diff";
import {flushCycle} from "./patch-diff.spec";

describe('deferred', () => {
    describe('apply', () => {
        it('should notify of object change with apply on path', async () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd'}}}, { defer: true });
            const spy = jest.fn();
            const isAggregated = true;
            patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            expect(spy).toHaveBeenNthCalledWith(1, { c: 'd'}, {snapshot: true}, {}, false);

            //Act
            patcher.apply({ e: 'f' }, 'a.b');
            patcher.apply({ g: 'h' }, 'a.b');
            patcher.apply({ i: [0,1,2] }, 'a.b');
            patcher.apply({ s: {a :1 } }, 'a.b');

            //Assert
            expect(patcher.get()).toEqual({a: {b: {c: 'd', e: 'f', g: 'h', i: [0,1,2], s: {a:1} }}});
            await flushCycle();
            expect(spy).toHaveBeenNthCalledWith(2, { e: 'f', g: 'h', i: [0,1,2], s: {a:1} }, expect.objectContaining({"addedObjects": {i:true,s:true}, "additions": {e: 'f', g: 'h', i: [0,1,2], s:{a:1}}, "deletions": {}, "differences": {e: 'f', g: 'h', i: [0,1,2], s:{a:1}}, "hasAddedObjects": true, "hasAdditions": true, "hasDeletions": false, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
        });

        it('should notify of object change with apply on self (without path)', async () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd'}}}, { defer: true });
            const spy = jest.fn();
            const isAggregated = true;
            patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            expect(spy).toHaveBeenNthCalledWith(1, { c: 'd'}, {snapshot: true}, {}, false);

            //Act
            patcher.apply({a: {b: {e: 'f'}}});

            //Assert
            expect(patcher.get()).toEqual({a: {b: {c: 'd', e: 'f'}}});
            await flushCycle();
            expect(spy).toHaveBeenNthCalledWith(2, { e: 'f'}, expect.objectContaining({"addedObjects": {}, "additions": {"e": "f"}, "deletions": {}, "differences": {"e": "f"}, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": false, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
        });

        it('should notify of all object changes with apply when patch, deletion and override are used', async () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd', e: 'f', g: { h: 'i', j: 'k' }}}}, { defer: true });
            const overrides = { 'a.b.c.g': true };
            const spy = jest.fn();
            const isAggregated = true;
            patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            expect(spy).toHaveBeenNthCalledWith(1, { c: 'd', e: 'f', g: { h: 'i', j: 'k' }}, {snapshot: true}, {}, false);

            //Act
            patcher.apply({
                a: {
                    b: {
                        e: 'patch',
                        c: patcher.options.deleteKeyword,
                        g: 5
                    }
                }
                // @ts-expect-error
            }, '', {overrides});

            //Assert
            expect(patcher.get()).toEqual({a: {b: {e: 'patch', g: 5}}});
            await flushCycle();
            expect(spy).toHaveBeenNthCalledWith(2, { c: patcher.options.deleteKeyword, e: 'patch', g: 5}, expect.objectContaining({"addedObjects": {}, "additions": {}, "deletions": {"c": "d"}, "differences": {"c": "__$$D", "e": "patch", "g": 5}, "hasAddedObjects": false, "hasAdditions": false, "hasDeletions": true, "hasDifferences": true, "hasUpdates": true, "path": "a.b", "updates": {"e": {"newVal": "patch", "oldVal": "f"}, "g": {"newVal": 5, "oldVal": {"h": "i", "j": "k"}}}}), {}, isAggregated);
        });
    });

    describe('set', () => {
        it.failing('should notify of object change with set on path', async () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd'}}}, { defer: true });
            const spy = jest.fn();
            const isAggregated = true;
            patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            expect(spy).toHaveBeenNthCalledWith(1, { c: 'd'}, {snapshot: true}, {}, false);

            //Act
            patcher.set({ e: 'f' }, 'a.b');
            patcher.set({ g: 'i' }, 'a.b.e');

            //Assert
            expect(patcher.get()).toEqual({a: {b: {e: {g: 'i'}}}});
            await flushCycle();
            //todo: hasDeletions is false while 'c' is deleted
            expect(spy).toHaveBeenNthCalledWith(2, { c: '__$$D', e: {g:'i'}}, expect.objectContaining({"addedObjects": {}, "additions": {"e": {g:'i'}}, "deletions": {c: 'd'}, "differences": {"c": "__$$D", "e": {g:'i'}}, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
        });

        it('should notify of object change with apply on self (without path)', async () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd'}}}, {defer: true});
            const spy = jest.fn();
            const isAggregated = true;
            patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            expect(spy).toHaveBeenNthCalledWith(1, { c: 'd'}, {snapshot: true}, {}, false);

            //Act
            patcher.set({a: {b: {e: 'f'}}});

            //Assert
            expect(patcher.get()).toEqual({a: {b: {e: 'f'}}});
            await flushCycle();
            expect(spy).toHaveBeenNthCalledWith(2, { c: '__$$D', e: 'f'}, expect.objectContaining({"addedObjects": {}, "additions": {"e": "f"}, "deletions": {c: 'd'}, "differences": {"c": "__$$D", "e": "f"}, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
        });
    });

    describe('remove', () => {
        it.failing('should notify of object change with remove on path', async () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd'}}}, { defer: true });
            const spy = jest.fn();
            const isAggregated = true;

            //Act
            patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            patcher.apply({a: {b: {c: 'e'}}});
            patcher.remove('a.b');

            //Assert
            expect(spy).toHaveBeenNthCalledWith(1, { c: 'e'}, {snapshot: true}, {}, false);
            expect(patcher.get()).toEqual({a: {}});
            await flushCycle();
            //todo: isAggregated is false while expected true
            expect(spy).toHaveBeenNthCalledWith(2, '__$$D', expect.objectContaining({"deletions": {c: 'e'}, "differences": '__$$D', "hasAddedObjects": false, "hasAdditions": false, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false}), {}, isAggregated);
        });

        it.failing('should notify of object change with remove on self (without path)', async () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd'}}}, {defer: true});
            const spy = jest.fn();
            const isAggregated = true;
            patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                console.log('a.b', diff, changeInfo, context, isAggregated);
                spy(diff, changeInfo, context, isAggregated);
            });
            expect(spy).toHaveBeenNthCalledWith(1, { c: 'd'}, {snapshot: true}, {}, false);

            //Act
            patcher.remove();

            //Assert
            expect(patcher.get()).toEqual({});
            await flushCycle();
            //todo: we are not getting any notification for deletion in this case
            expect(spy).toHaveBeenNthCalledWith(2, patcher.options.deleteKeyword, expect.objectContaining({"addedObjects": {}, "additions": {}, "deletions": {c: 'd'}, "differences": '__$$D', "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
        });
    });
});