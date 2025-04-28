import PatchDiff from '../../patch-diff/src/patch-diff.js';
import {Replica as LiveReplica, get, set, merge, cloneDeep, replace, observe, nextChange, patch} from "../../../index";

beforeEach(() => {
    jest.resetAllMocks();
});

describe('Proxy', () => {

    describe('Object handling', () => {
        it('should be able to add object property', async () => {
            //Arrange
            const patcher = new PatchDiff({a: 'b'});
            const patcherProxy = patcher.getData();

            //Act
            patcherProxy.b = 'd';
            patcherProxy.b = 'd';
            patcherProxy.c = 'd';

            //Assert
            expect(patcher.get()).toEqual({a: 'b', b: 'd', c: 'd'});
        });

        it('should be able to add nested object property', async () => {
            //Arrange
            const patcher = new PatchDiff({a: 'b'});
            const patcherProxy = patcher.getData();

            //Act
            patcherProxy.b = {c: 'd'};
            patcherProxy.b.c = 'e';
            patcherProxy.b.d = 'g';

            //Assert
            expect(patcher.get()).toEqual({a: 'b', b: {c: 'e', d: 'g'}});
        });

        it('should be able to delete object property', async () => {
            //Arrange
            const patcher = new PatchDiff({a: 'b', f: 'g'});
            const patcherProxy = patcher.getData();

            //Act
            delete patcherProxy.a;

            //Assert
            expect(patcher.get()).toEqual({f: 'g'});
        });

        it('should be able to delete a nested object property', async () => {
            //Arrange
            const patcher = new PatchDiff({c: {d: 'e'}, f: 'g'});
            const patcherProxy = patcher.getData();

            //Act
            delete patcherProxy.c;

            //Assert
            expect(patcher.get()).toEqual({f: 'g'});
        });


        it('should be able to update object property', async () => {
            //Arrange
            const patcher = new PatchDiff({a: 'b'});
            const patcherProxy = patcher.getData();

            //Act
            patcherProxy.a = 'd';

            //Assert
            expect(patcher.get()).toEqual({a: 'd'});
        });

        it('should be able to use for..in loop', () => {
            //Arrange
            const initObj = {a: 'b', c: 'd'};
            const patcher = new PatchDiff(initObj);
            const patcherProxy = patcher.getData();
            const result = [];

            //Act
            for (const key in patcherProxy) {
                result.push(key);
            }

            //Assert
            expect(result).toEqual(Object.keys(initObj));
        });

        it('should be able to spread object properties', () => {
            //Arrange
            const initObj = {a: 'b', c: 'd'};
            const patcher = new PatchDiff(initObj);
            const patcherProxy = patcher.getData();

            //Act
            const result = {...patcherProxy};

            //Assert
            expect(result).toEqual(initObj);
            expect(result).not.toBe(initObj);
        });
    });

    describe('Array handling', () => {
        it('should be able to add array item', async () => {
            //Arrange
            const patcher = new PatchDiff(['a']);
            const patcherProxy = patcher.getData();

            //Act
            patcherProxy.push('b');

            //Assert
            expect(patcher.get()).toEqual(['a', 'b']);
        });

        it('should be able to delete array item', async () => {
            //Arrange
            const patcher = new PatchDiff(['a']);
            const patcherProxy = patcher.getData();

            //Act
            patcherProxy.pop();

            //Assert
            expect(patcher.get()).toEqual([]);
        });

        it('should be able to update array item', async () => {
            //Arrange
            const patcher = new PatchDiff(['a']);
            const patcherProxy = patcher.getData();

            //Act
            patcherProxy[0] = 'b';

            //Assert
            expect(patcher.get()).toEqual(['b']);
        });

        it('should be able to spread array items', () => {
            //Arrange
            const initArr = ['a', 'b'];
            const patcher = new PatchDiff(initArr);
            const patcherProxy = patcher.getData();

            //Act
            const result = [...patcherProxy];

            //Assert
            expect(result).toEqual(initArr);
            expect(result).not.toBe(initArr);
        });

        it('should be able to use splice as in Array prototype', () => {
            //Arrange
            const initArr = ['a', 'b'];
            const patcher = new PatchDiff(initArr);
            const patcherProxy = patcher.getData();

            //Act
            patcherProxy.splice(1, 1, 'c');

            //Assert
            expect(patcher.get()).toEqual(['a', 'c']);
        });
    });

    describe('Functional API', () => {
        describe('get', () => {
            it('should throw for non proxy objects', () => {
                //Arrange
                const dataProxy = {
                    foo: {
                        bar: 'baz'
                    }
                };

                //Act
                const result = () => get(dataProxy, 'foo.bar');

                //Assert
                expect(result).toThrowError(new TypeError(`trying to get from a non LiveReplica Proxy type`));
            });

            it('should get value at path', () => {
                //Arrange
                const dataProxy = LiveReplica.create({
                    foo: {
                        bar: 'baz'
                    }
                }, {allowWrite: true});

                //Act
                const result = get(dataProxy, 'foo.bar');

                //Assert
                expect(result).toEqual('baz');
            });
        });

        describe('set', () => {
            it('should throw for non proxy objects', () => {
                //Arrange
                const dataProxy = {
                    foo: {
                        bar: 'baz'
                    }
                };

                //Act
                const result = () => set(dataProxy, 'foo.bar', 'qux');

                //Assert
                expect(result).toThrowError(new TypeError(`trying to set a non LiveReplica Proxy type`));
            });

            it('should throw if path is not provided', () => {
                //Arrange
                const dataProxy = LiveReplica.create({
                    foo: {
                        bar: 'baz'
                    }
                }, {allowWrite: true});

                //Act
                const result = () => set(dataProxy, null, 'qux');

                //Assert
                expect(result).toThrowError(new TypeError(`path cannot be empty`));
            });

            it('should set value at path', () => {
                //Arrange
                const dataProxy = LiveReplica.create({
                    foo: {
                        bar: 'baz'
                    }
                }, {allowWrite: true});

                //Act
                set(dataProxy, 'foo.bar', 'qux');

                //Assert
                expect(dataProxy).toEqual({foo: {bar: 'qux'}});
            });
        });

        describe('merge', () => {
            it('should throw for non proxy objects', () => {
                //Arrange
                const dataProxy = {
                    foo: {
                        bar: 'baz'
                    }
                };

                //Act
                const result = () => merge(dataProxy, 'foo.bar', 'qux');

                //Assert
                expect(result).toThrowError(new TypeError(`trying to merge a non LiveReplica Proxy type`));
            });

            it('should merge value at path and notify observer', () => {
                //Arrange
                const dataProxy = LiveReplica.create({
                    foo: {
                        bar: 'baz'
                    }
                }, {allowWrite: true});
                const observerSpy = jest.fn();

                //Act
                observe(dataProxy, 'foo.bar', observerSpy);
                merge(dataProxy.foo, {bar: 'qux'});

                //Assert
                expect(dataProxy).toEqual({foo: {bar: 'qux'}});
                expect(observerSpy).toHaveBeenCalledTimes(2);
                expect(observerSpy).toHaveBeenNthCalledWith(1, 'baz', {snapshot: true}, {}, false, undefined);
                expect(observerSpy).toHaveBeenNthCalledWith(2, "qux", {
                    "differences": "qux",
                    "updates": {"newVal": "qux", "oldVal": "baz"}
                }, {local: true}, false, undefined);
            });
        });

        describe('cloneDeep', () => {
            it('should throw for non proxy objects', () => {
                //Arrange
                const dataProxy = {
                    foo: {
                        bar: 'baz'
                    }
                };

                //Act
                const result = () => cloneDeep(dataProxy, 'foo.bar');

                //Assert
                expect(result).toThrowError(new TypeError(`trying to cloneDeep a non LiveReplica Proxy type`));
            });

            it('should clone value at path', () => {
                //Arrange
                const dataProxy = LiveReplica.create({
                    foo: {
                        bar: 'baz'
                    }
                }, {allowWrite: true});

                //Act
                const fooClone = cloneDeep(dataProxy, 'foo');

                //Assert
                expect(fooClone).toEqual(dataProxy.foo);
                expect(fooClone).not.toBe(dataProxy.foo);
            });
        });

        describe('replace', () => {
            it('should throw for non proxy objects', () => {
                //Arrange
                const dataProxy = {
                    foo: {
                        bar: 'baz'
                    }
                };

                //Act
                const result = () => replace(dataProxy, {bar: 'qux'});

                //Assert
                expect(result).toThrowError(new TypeError(`trying to replace a non LiveReplica Proxy type`));
            });

            it('should replace the entire proxy value (at root level)', () => {
                //Arrange
                const dataProxy = LiveReplica.create({
                    foo: {
                        bar: 'baz'
                    }
                }, {allowWrite: true});
                const observerSpy = jest.fn();

                //Act
                observe(dataProxy, observerSpy);
                expect(observerSpy).toHaveBeenNthCalledWith(1, {foo: {bar: 'baz'}}, {snapshot: true}, {}, false, undefined);
                replace(dataProxy, {bar: 'qux'});

                //Assert
                expect(dataProxy).toEqual({bar: 'qux'});
                expect(observerSpy).toHaveBeenCalledTimes(2);
                expect(observerSpy).toHaveBeenNthCalledWith(2, {bar: 'qux', foo: "__$$D"}, expect.objectContaining({
                    "deletions": {"foo": {"bar": "baz"}},
                    "differences": {"bar": "qux", "foo": "__$$D",},
                    "hasAddedObjects": false,
                    "hasAdditions": true,
                    "hasDeletions": true,
                    "hasDifferences": true,
                    "hasUpdates": false,
                    "path": "$remote",
                    "updates": {},
                    "addedObjects": {},
                    "additions": {"bar": "qux"}
                }), {local: true}, false, undefined);
            });
        });

        describe('nextChange', () => {
            it('should throw for non proxy objects', () => {
                //Arrange
                const dataProxy = {
                    foo: {
                        bar: 'baz'
                    }
                };

                //Act
                const result = () => replace(dataProxy, {bar: 'qux'});

                //Assert
                expect(result).toThrowError(new TypeError(`trying to replace a non LiveReplica Proxy type`));
            });

            it('should return a promise that resolves to the next change', async () => {
                //Arrange
                const dataProxy = LiveReplica.create({
                    foo: {
                        bar: 'baz'
                    }
                }, {allowWrite: true});

                //Act & Assert
                merge(dataProxy.foo, {bar: 'qux'});
                const result = await nextChange(dataProxy);
                expect(result).toEqual({foo: {bar: 'qux'}});

                replace(dataProxy.foo, {bar: 'qux2'});
                const result2 = await nextChange(dataProxy);
                expect(result2).toEqual({foo: {bar: 'qux2'}});
            });
        });
        
        describe('patch', () => {
            it('should throw for non proxy objects', () => {
                //Arrange
                const dataProxy = {
                    foo: {
                        bar: 'baz'
                    }
                };

                //Act
                const result = () => patch(dataProxy, 'foo.bar', 'qux');

                //Assert
                expect(result).toThrowError(new TypeError(`trying to patch a non LiveReplica Proxy type`));
            });

            it('should throw if path is not provided', () => {
                //Arrange
                const dataProxy = LiveReplica.create({
                    foo: {
                        bar: 'baz'
                    }
                }, {allowWrite: true});

                //Act
                const result = () => patch(dataProxy, null, 'qux');

                //Assert
                expect(result).toThrowError(new TypeError(`path cannot be empty`));
            });

            it('should set value at path', () => {
                //Arrange
                const dataProxy = LiveReplica.create({
                    foo: {
                        bar: 'baz'
                    }
                }, {allowWrite: true});

                //Act
                patch(dataProxy, 'foo', { fizz: 'buzz' });

                //Assert
                expect(dataProxy).toEqual({foo: {bar: 'baz', fizz: 'buzz'}});
            });
        });

        describe('observe', () => {
            it('should throw for non proxy objects', () => {
                //Arrange
                const dataProxy = {
                    foo: {
                        bar: 'baz'
                    }
                };

                //Act
                const result = () => observe(dataProxy, 'foo.bar', () => {
                });

                //Assert
                expect(result).toThrowError(new TypeError(`trying to observe a non LiveReplica Proxy type`));
            });

            it.skip('should observe value at path', () => {
                //Arrange
                const dataProxy = LiveReplica.create({
                    foo: {
                        bar: 'baz'
                    }
                }, {allowWrite: true});
                const observerSpy = jest.fn();

                //Act
                observe(dataProxy, 'foo.bar', observerSpy);
                dataProxy.foo.bar = 'qux';

                //Assert
                expect(observerSpy).toHaveBeenCalledTimes(2);
                expect(observerSpy).toHaveBeenNthCalledWith(1, 'baz', {snapshot: true}, {}, false);
                expect(observerSpy).toHaveBeenNthCalledWith(2, "qux", {
                    "differences": "qux",
                    "updates": {"newVal": "qux", "oldVal": "baz"}
                }, {local: true}, false);
            });
        });
    });
});
