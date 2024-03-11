import PatchDiff from '../src/patch-diff.js';

beforeEach(() => {
    jest.resetAllMocks();
});

export function flushCycle(timeout = 0) {
    return new Promise((resolve) => setTimeout(resolve, timeout));
}

describe('Patch Diff', () => {
    describe('apply', () => {
        describe('Bad path', () => {
            it('should emit error when max levels exceeded and not apply any further levels', (done) => {
                //Arrange
                const patcher = new PatchDiff(null, {maxLevels: 2});
                patcher.on('error', (error) => {
                    //Assert
                    expect(error).toEqual(new Error('Stopped patching, Too many levels - 3 out of 2 allowed levels to path "1.2.3"'));
                    expect(patcher.get()).toEqual({1: {2: {3: {}}}});
                    done();
                });

                //Act
                patcher.apply({1: {2: {3: {4: {5: '5th level'}}}}});
            });

            describe('No patch and path', () => {
                it('should make no changes to underlying object and print error', () => {
                    //Arrange
                    const patcher = new PatchDiff({a: 'b'});
                    jest.spyOn(console, 'error');

                    //Act
                    patcher.apply();

                    //Assert
                    expect(console.error).toBeCalledWith('LiveReplica PatchDiff: invalid apply, target and patch must be objects');
                    expect(patcher.get()).toEqual({a: 'b'});
                });
            });

            describe('Whitelisted keys enabled', () => {
                it('should not modify non whitelisted paths', () => {
                    //Arrange
                    const baseObject = {
                        allowParent: 'b'
                    };
                    const patcher = new PatchDiff(baseObject);
                    patcher.whitelist(['allowParent']);

                    //Act
                    patcher.apply(5, 'c.d');
                    patcher.apply({ new: 'change' }, 'allowParent');

                    //Assert
                    expect(patcher.get()).toEqual({
                        allowParent: { new: 'change' }
                    });
                });

                it('should not modify non whitelisted paths when path is not provided', () => {
                    //Arrange
                    const baseObject = {
                        allowParent: 'a'
                    };
                    const patcher = new PatchDiff(baseObject);
                    patcher.whitelist(['allowParent', 'allowParent2']);

                    //Act
                    patcher.apply({ newNonWhitelistedParent: 'change', allowParent2: 'change' });

                    //Assert
                    expect(patcher.get()).toEqual({
                        allowParent: 'a',
                        allowParent2: 'change'
                    });
                });
            });
        });

        describe('Good path', () => {
            describe('All value types can be applied', () => {
                it.each`
              test          | sourceObject                    | expectedObject 
              ${'string'}   | ${{string: 'string'}}           | ${{string: 'string'}}
              ${'number'}   | ${{number: 5}}                  | ${{number: 5}}
              ${'boolean'}  | ${{boolean: true}}              | ${{boolean: true}}
              ${'object'}   | ${{object: {hello: 'world'}}}   | ${{object: {hello: 'world'}}}              
            `('should apply $test', ({sourceObject, expectedObject}) => {
                    //Arrange
                    const patcher = new PatchDiff();

                    //Act
                    patcher.apply(sourceObject);

                    //Assert
                    expect(patcher.get()).toEqual(expectedObject);
                });

                it('should be able to apply a proxy object', () => {
                    //Arrange
                    const patcher = new PatchDiff({ a: 'b' });
                    const proxy = patcher.getData({immediateFlush: true});
                    proxy.b = 'c';
                    const expectedObject = { a: 'b', b: 'c' };

                    //Act
                    patcher.apply(proxy);

                    //Assert
                    expect(patcher.get()).toEqual(expectedObject);
                });
            });

            describe('Object is updated incrementally', () => {
                let patcher;
                beforeAll(() => {
                    patcher = new PatchDiff();
                })

                it.each`
              test          | key           | value                                             | expectedObject 
              ${'string'}   | ${'string'}   | ${'string'}                                       | ${{ string: 'string' }}
              ${'number'}   | ${'number'}   | ${5}                                              | ${{ string: 'string', number: 5 }}
              ${'boolean'}  | ${'boolean'}  | ${true}                                           | ${{ string: 'string', number: 5, boolean: true }}
              ${'object'}   | ${'object'}   | ${{hello: 'world'}}                               | ${{ string: 'string', number: 5, boolean: true, object: {hello: 'world'}}}
              ${'nested'}   | ${'object'}   | ${{hello: {world: {print: 'end'}}}}               | ${{ string: 'string', number: 5, boolean: true, object: {hello: {world: {print: 'end'}}}}}}
              ${'nested'}   | ${'object'}   | ${{hello: {world: {additionalProp: 'test'}}}}     | ${{ string: 'string', number: 5, boolean: true, object: {hello: {world: {print: 'end', additionalProp: 'test'}}}}}}
              ${'undefined'}| ${'object'}   | ${{hello: {world: '__$$U'}}}                      | ${{ string: 'string', number: 5, boolean: true, object: {hello: {world: undefined}}}}              
              ${'undefined'}| ${'object'}   | ${{hello: undefined }}                            | ${{ string: 'string', number: 5, boolean: true, object: {hello: undefined}}}              
            `('should apply addition of $test property', ({key, value, expectedObject}) => {
                    //Act
                    patcher.apply({[key]: value});

                    //Assert
                    expect(patcher.get()).toEqual(expectedObject);
                });
            });

            describe('apply at path', () => {
                it.each`
                  path               | expectedObject 
                  ${'a'}             | ${{a: 5}}
                  ${'a.4'}           | ${{a: {4: 5}}}
                  ${'a.4tyu.@l'}     | ${{a: {'4tyu': {'@l': 5}}}}                          
            `('should update value at given path $path', ({path, expectedObject}) => {
                    //Arrange
                    const patcher = new PatchDiff({a: 'b'});

                    //Act
                    patcher.apply(5, path);

                    //Assert
                    expect(patcher.get()).toEqual(expectedObject);
                });
            });

            it('should allow to apply with certain paths treated as overrides', () => {
                //Arrange
                const overrides = {
                    'a.b.override1': true,
                    'a.b.override2': true
                };
                const patcher = new PatchDiff({a: {b: {
                    c: {d: 'e'},
                    override1: {f: 'g'},
                    override2: {h: 'i'}
                }}});

                //Act
                patcher.apply({a: {b: {
                    c: { appliedToC: 'someValue'},
                    override1: { overrides1: 'someValue'},
                    override2: { overrides1: 'someValue'}
                }}}, '', {overrides});

                //Assert
                expect(patcher.get()).toEqual({a: {b: {
                    c: {d: 'e', appliedToC: 'someValue'}, // {d: 'e'} is not overridden, {appliedToC: 'someValue'} is added
                    override1: {overrides1: 'someValue'}, // {f: 'g'} is overridden
                    override2: {overrides1: 'someValue'}  // {h: 'i'} is overridden
                }}});
            });
            
            describe('Array manipulations', () => {
                it.each`
                    test             | initArray   | patchArray     | expectedArray
                    ${'add item'}    | ${[1,2]}    | ${[1,2,3]}     | ${[1,2,3]}
                    ${'update item'} | ${[1,2,3]}  | ${[1,3]}       | ${[1,3,3]}
                    ${'remove item'} | ${[1,2,3]}  | ${[1,'__$$D']} | ${[1,3]}
                `('should be able to $test', ({initArray, patchArray, expectedArray}) => {
                    //Arrange
                    const patcher = new PatchDiff(initArray);

                    //Act
                    patcher.apply(patchArray);

                    //Assert
                    expect(patcher.get()).toEqual(expectedArray);
                });

                it.each`
                    path               | expectedObject
                    ${'a[0]'}          | ${{a: ['appliedValue', 'b', false, { hello: 'world' }]}}
                    ${'a[1]'}          | ${{a: [1, 'appliedValue', false, { hello: 'world' }]}}
                    ${'a[3].hello'}    | ${{a: [1, 'b', false, { hello: 'appliedValue' }]}}
                    ${'a["3"].hello'}  | ${{a: [1, 'b', false, { hello: 'appliedValue' }]}}
                `('should update array value at given path $path', ({ path, expectedObject }) => {
                    //Arrange
                    const patcher = new PatchDiff({a: [1, 'b', false, { hello: 'world' }]});

                    //Act
                    patcher.apply('appliedValue', path);

                    //Assert
                    expect(patcher.get()).toEqual(expectedObject);
                });
            });
        });
    });
    describe('set', () => {
        it('should override the object', () => {
            //Arrange
            const patcher = new PatchDiff({hello: {world: {print: 'end'}}});
            const overrideObject = {hello: {world: {overriddenProperty: 'test'}}};

            //Act
            patcher.set(overrideObject);

            //Assert
            expect(patcher.get()).toEqual(overrideObject);
        });

        describe('No fullDocument and path', () => {
            it('should make no changes to underlying object and print error', () => {
                //Arrange
                const patcher = new PatchDiff({a: 'b'});
                jest.spyOn(console, 'error');

                //Act
                patcher.set();

                //Assert
                expect(console.error).toBeCalledWith('LiveReplica PatchDiff: invalid set, fullDocument must be an object');
                expect(patcher.get()).toEqual({a: 'b'});
            });
        });

        describe('whitelist', () => {
            it('should throw an error when set is used with whitelist', () => {
                //Arrange
                const patcher = new PatchDiff({a: 'b'});
                patcher.whitelist(['a']);

                //Act & Assert
                expect(() => patcher.set({a: 'c'})).toThrowError('LiveReplica PatchDiff: set is not supported with whitelist');
            });
        });

        it('should be able to set a proxy object', () => {
            //Arrange
            const patcher = new PatchDiff({ a: 'b' });
            const proxy = patcher.getData({immediateFlush: true});
            proxy.b = 'c';
            const expectedObject = { a: 'b', b: 'c' };

            //Act
            patcher.set(proxy);

            //Assert
            expect(patcher.get()).toEqual(expectedObject);
        });
    });
    describe('remove', () => {
        it('should remove any data at given path', () => {
            //Arrange
            const patcher = new PatchDiff({
                a: {
                    b: { c: 'd' },
                    e: 'f'
                }
            });

            //Act
            patcher.remove('a.b');
            patcher.remove('a.e');

            //Assert
            expect(patcher.get()).toEqual({a: {}});
        });

        it('should remove all data if no path provided while considering the initial type', () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd'}}});
            const arrPatcher = new PatchDiff([1, 2, 3]);

            //Act
            patcher.remove();
            arrPatcher.remove();

            //Assert
            expect(patcher.get()).toEqual({});
            expect(arrPatcher.get()).toEqual([]);
        });
    });
    describe('splice', () => {
        it.failing('should apply data changes to arrays', () => {
            //Arrange
            const patcher = new PatchDiff([1, 2, 3]);

            //Act
            patcher.splice({
                index: 1,
                itemsToRemove: 1,
                itemsToAdd: [4, 5]
            });

            //Assert
            // bug: __$S object in the result of get
            expect(patcher.get()).toEqual([1, 4, 5, 3]);
        });
    });
    describe('get', () => {
        it('should return the underlying object', () => {
            //Arrange
            const initObject = {a: 'b'};
            const patcher = new PatchDiff(initObject);

            //Act
            const result = patcher.get();

            //Assert
            expect(result).toBe(initObject);
        });

        it('should log error for invalid path argument', () => {
            //Arrange
            const patcher = new PatchDiff({a: 'b'});
            jest.spyOn(console, 'error');

            //Act
            patcher.get(5);

            //Assert
            expect(console.error).toBeCalledWith('LiveReplica PatchDiff: invalid path, cannot get');
        });

        describe('callback api', () => {
            it('should return the data immediately if its available', () => {
                //Arrange
                const initObject = {a: 'b'};
                const patcher = new PatchDiff(initObject);
                const spy = jest.fn();

                //Act
                patcher.get(spy);

                //Assert
                expect(spy).toHaveBeenCalledWith(initObject);
            });
            it('should return the data when it becomes available', () => {
                //Arrange
                const initObject = {a: 'b'};
                const patcher = new PatchDiff();
                const spy = jest.fn();

                //Act
                patcher.get(spy);
                patcher.apply(initObject);

                //Assert
                expect(spy).toHaveBeenCalledWith(initObject);
            });
        });
    });

    describe('getAll', () => {
        it('should return the underlying object', () => {
            //Arrange
            const initObject = {a: 'b', items: {
                itemKey1: {
                    itemVal: 'itemValue1'
                },
                itemKey2: {
                    itemVal: 'itemValue2'
                }
            }};

            const patcher = new PatchDiff(initObject);
            //Act
            const result = patcher.getAll('items[:itemKey].itemVal');
            //Assert
            expect(result).toStrictEqual([
                {value: 'itemValue1', params: {itemKey: 'itemKey1'}},
                {value: 'itemValue2', params: {itemKey: 'itemKey2'}}
            ]);
        });

    });

    describe('getClone', () => {
        it('should return a clone of the underlying object', () => {
            //Arrange
            const initObject = {a: 'b'};
            const patcher = new PatchDiff(initObject);

            //Act
            const result = patcher.getClone();

            //Assert
            expect(result).toEqual(initObject);
            expect(result).not.toBe(initObject);
        });
        it('should return a clone of the underlying object with only whitelisted keys', () => {
            //Arrange
            const initObject = {a: 'b', c: 'd'};
            const patcher = new PatchDiff(initObject);
            patcher.whitelist(['a']);

            //Act
            const result = patcher.getClone();

            //Assert
            expect(result).toEqual({a: 'b'});
        });
    });
    describe('on', () => {
        it.todo('future');
    });
    describe('subscribe', () => {
        it('should notify of all changes on a given path', async () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd'}}});
            const spy = jest.fn();
            patcher.subscribe('a.b.c', (diff, changeInfo, context) => {
                console.log('a.b.c', diff, changeInfo, context);
                spy(diff, changeInfo, context);
            });

            const context = {some: 'context'};

            //Act
            patcher.apply(5, 'a.b.c');
            patcher.remove( 'a.b.c');
            patcher.apply({ e: 'f' }, 'a.b.c');
            patcher.apply({ e: {f: true} }, 'a.b.c', { context });
            patcher.set({ e: { set: 'value' } }, 'a.b.c');

            //Assert snapshot notification
            expect(spy).toHaveBeenCalledWith('d', {snapshot: true}, {});
            expect(spy).toHaveBeenCalledWith(5, { differences: 5, updates: { oldVal: 'd', newVal: 5 } }, {});
            expect(spy).toHaveBeenCalledWith(patcher.options.deleteKeyword, expect.objectContaining({ differences: patcher.options.deleteKeyword, deletions: 5 }), {});
            expect(spy).toHaveBeenCalledWith({e:'f'}, expect.objectContaining({
                hasAdditions: true,
                hasAddedObjects: false,
                hasDeletions: false,
                hasUpdates: false,
                hasDifferences: true,
                additions: {e: "f"},
                deletions: {},
                updates: {},
                addedObjects: {},
                differences: {e: "f"},
                path: "a.b.c"
            }), expect.any(Object));
            expect(spy).toHaveBeenCalledWith({e: {f: true}}, expect.objectContaining({
                hasAdditions: true,
                hasAddedObjects: false,
                hasDeletions: false,
                hasUpdates: false,
                hasDifferences: true,
                additions: {e: {f: true}},
                deletions: {},
                updates: {},
                addedObjects: {},
                differences: {e: {f: true}},
                path: "a.b.c"
            }), context);
            // console.log('spy', spy.mock.calls);
            expect(spy).toHaveBeenCalledWith({e: {set: 'value', f: patcher.options.deleteKeyword }}, expect.objectContaining({
                hasAdditions: true,
                hasAddedObjects: false,
                hasDeletions: true,
                hasUpdates: false,
                hasDifferences: true,
                additions: {e: {set: 'value'}},
                deletions: {e: {f: true}},
                updates: {},
                addedObjects: {},
                differences: {e: { set: "value", f: "__$$D" }},
                path: "a.b.c"
            }), {});
        });

        it('should be able to notify multiple changes in a single update', async () => {
            //Arrange
            const initObject = {a: {b: {c: 'd'}, toUpdate: 'f', toDelete: {g: 'h'}}};
            const patcher = new PatchDiff(initObject);
            const spy = jest.fn();
            patcher.subscribe('a', (diff, changeInfo, context) => {
                console.log('a', diff, changeInfo, context);
                spy(diff, changeInfo, context);
            });

            //Act
            const overrideObject = {a: {b: 'objectToString', toUpdate: 'newValue', newObject: {}}};
            patcher.set(overrideObject);

            //Assert snapshot notification
            expect(spy).toHaveBeenCalledWith(initObject.a, {snapshot: true}, {});
            expect(spy).toHaveBeenCalledWith({
                b: 'objectToString',
                toUpdate: 'newValue',
                newObject: {},
                toDelete: patcher.options.deleteKeyword
            }, expect.objectContaining({
                hasAdditions: true,
                hasAddedObjects: true,
                hasDeletions: true,
                hasUpdates: true,
                hasDifferences: true,
                additions: {newObject: {}},
                deletions: {
                    toDelete: {g: 'h'}
                },
                updates: {
                    b: { oldVal: { c: 'd' }, newVal: 'objectToString' },
                    toUpdate: { oldVal: 'f', newVal: 'newValue' }
                },
                addedObjects: { newObject: true },
                differences: {
                    b: 'objectToString',
                    toUpdate: 'newValue',
                    newObject: {},
                    toDelete: patcher.options.deleteKeyword
                },
                path: 'a'
            }), expect.any(Object));
        });

        it('should notify self if parent is deleted', () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd'}}});
            const spy = jest.fn();
            patcher.subscribe('a.b.c', (diff, changeInfo, context) => {
                console.log('a.b.c', diff, changeInfo, context);
                spy(diff, changeInfo, context);
            });

            //Act
            patcher.remove('a.b');

            //Assert
            expect(spy).toHaveBeenCalledWith(patcher.options.deleteKeyword, expect.any(Object), {});
        });

        it('should notify of all changes on whitelisted paths and exclude the rest', async () => {
            //Arrange
            const patcher = new PatchDiff({a: 1, b: 2, c: 'd'});
            const spy = jest.fn();
            patcher.whitelist(['a']);
            patcher.subscribe('a', spy);
            patcher.subscribe('b', spy);

            //Act
            patcher.apply('changeToA', 'a');
            patcher.apply('changeToB', 'b');

            //Assert

            expect(spy).toHaveBeenCalledWith(1, {snapshot: true}, {}, false, undefined);
            expect(spy).toHaveBeenCalledWith('changeToA', {differences: 'changeToA', updates: {newVal: 'changeToA', oldVal: 1}}, {}, false, undefined);
            expect(spy).not.toHaveBeenCalledWith('changeToB', {differences: 'changeToB', updates: {newVal: 'changeToB', oldVal: 2}}, {}, false);
        });

        it('should allow to unsubscribe', async () => {
            //Arrange
            const patcher = new PatchDiff({a: {b: {c: 'd'}}});
            const spy = jest.fn();
            const unsubscribe = patcher.subscribe('a.b.c', spy);

            //Act
            patcher.apply('beforeUnsub', 'a.b.c');
            unsubscribe();
            patcher.apply('afterUnsub', 'a.b.c');

            //Assert
            expect(spy).toHaveBeenCalledWith('d', {snapshot: true}, expect.any(Object), false, undefined);
            expect(spy).toHaveBeenCalledWith('beforeUnsub', expect.any(Object), expect.any(Object), false, undefined);
            expect(spy).not.toHaveBeenCalledWith('afterUnsub', expect.any(Object), expect.any(Object), false);
        });

        describe('Mutation notifications with or without supplied path', () => {

            describe('apply', () => {
                it('should notify of object change with apply on path', async () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd'}}});
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    expect(spy).toHaveBeenCalledWith({ c: 'd'}, {snapshot: true}, {}, isAggregated);

                    //Act
                    patcher.apply({ e: 'f' }, 'a.b');

                    //Assert
                    expect(patcher.get()).toEqual({a: {b: {c: 'd', e: 'f'}}});
                    expect(spy).toHaveBeenCalledWith({ e: 'f'}, expect.objectContaining({"addedObjects": {}, "additions": {"e": "f"}, "deletions": {}, "differences": {"e": "f"}, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": false, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
                });

                it('should notify of object change with apply on self (without path)', () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd'}}});
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    expect(spy).toHaveBeenCalledWith({ c: 'd'}, {snapshot: true}, {}, isAggregated);

                    //Act
                    patcher.apply({a: {b: {e: 'f'}}});

                    //Assert
                    expect(patcher.get()).toEqual({a: {b: {c: 'd', e: 'f'}}});
                    expect(spy).toHaveBeenCalledWith({ e: 'f'}, expect.objectContaining({"addedObjects": {}, "additions": {"e": "f"}, "deletions": {}, "differences": {"e": "f"}, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": false, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
                });

                it('should notify of all object changes with apply when patch, deletion and override are used', () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd', e: 'f', g: { h: 'i', j: 'k' }}}});
                    const overrides = { 'a.b.c.g': true };
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    expect(spy).toHaveBeenCalledWith({ c: 'd', e: 'f', g: { h: 'i', j: 'k' }}, {snapshot: true}, {}, isAggregated);

                    //Act
                    patcher.apply({
                        a: {
                            b: {
                                e: 'patch',
                                c: patcher.options.deleteKeyword,
                                g: 5
                            }
                        }
                    }, '', {overrides});

                    //Assert
                    expect(patcher.get()).toEqual({a: {b: {e: 'patch', g: 5}}});
                    expect(spy).toHaveBeenCalledWith({ c: patcher.options.deleteKeyword, e: 'patch', g: 5}, expect.objectContaining({"addedObjects": {}, "additions": {}, "deletions": {"c": "d"}, "differences": {"c": "__$$D", "e": "patch", "g": 5}, "hasAddedObjects": false, "hasAdditions": false, "hasDeletions": true, "hasDifferences": true, "hasUpdates": true, "path": "a.b", "updates": {"e": {"newVal": "patch", "oldVal": "f"}, "g": {"newVal": 5, "oldVal": {"h": "i", "j": "k"}}}}), {}, isAggregated);
                });
            });

            describe('set', () => {
                it('should notify of object change with set on path', async () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd'}}});
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    expect(spy).toHaveBeenCalledWith({ c: 'd'}, {snapshot: true}, {}, isAggregated);

                    //Act
                    patcher.set({ e: 'f' }, 'a.b');

                    //Assert
                    expect(patcher.get()).toEqual({a: {b: {e: 'f'}}});
                    expect(spy).toHaveBeenCalledWith({ c: '__$$D', e: 'f'}, expect.objectContaining({"addedObjects": {}, "additions": {"e": "f"}, "deletions": {c: 'd'}, "differences": {"c": "__$$D", "e": "f"}, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
                });

                it('should notify of object change with apply on self (without path)', () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd'}}});
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    expect(spy).toHaveBeenCalledWith({ c: 'd'}, {snapshot: true}, {}, isAggregated);

                    //Act
                    patcher.set({a: {b: {e: 'f'}}});

                    //Assert
                    expect(patcher.get()).toEqual({a: {b: {e: 'f'}}});
                    expect(spy).toHaveBeenCalledWith({ c: '__$$D', e: 'f'}, expect.objectContaining({"addedObjects": {}, "additions": {"e": "f"}, "deletions": {c: 'd'}, "differences": {"c": "__$$D", "e": "f"}, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
                });
            });

            describe('remove', () => {
                it('should notify of object change with remove on path', async () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd'}}});
                    const spy = jest.fn();
                    const isAggregated = false;

                    //Act
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    patcher.remove('a.b');

                    //Assert
                    expect(spy).toHaveBeenCalledWith({ c: 'd'}, {snapshot: true}, {}, isAggregated);
                    expect(patcher.get()).toEqual({a: {}});
                    expect(spy).toHaveBeenCalledWith('__$$D', expect.objectContaining({"deletions": {c: 'd'}, "differences": '__$$D', "hasAddedObjects": false, "hasAdditions": false, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false}), {}, isAggregated);
                });

                it('should notify of object change with remove on self (without path)', () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd'}}});
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    expect(spy).toHaveBeenCalledWith({ c: 'd'}, {snapshot: true}, {}, isAggregated);

                    //Act
                    patcher.remove();

                    //Assert
                    expect(patcher.get()).toEqual({});
                    //todo: we are not getting any notification for deletion in this case
                    //expect(spy).toHaveBeenCalledWith(patcher.options.deleteKeyword, expect.objectContaining({"addedObjects": {}, "additions": {}, "deletions": {c: 'd'}, "differences": '__$$D', "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
                });
            });
        });
        describe('Mutation notifications with path patterns', () => {

            describe('apply', () => {
                it('should notify of object change with apply on wildcard path subscription', async () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: {d: 'e'}}}});
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a[:unkownKey].c', (diff, changeInfo, context, isAggregated, params) => {
                        console.log('a[:unkownKey].c.d', diff, changeInfo, context, isAggregated, params);
                        spy(diff, changeInfo, context, isAggregated, params);
                    });
                    expect(spy).toHaveBeenCalledWith({ d: 'e'}, {snapshot: true}, {}, isAggregated, {unkownKey: 'b'});

                    //Act
                    patcher.apply({ e: 'changed' }, 'a.b.c.d');

                    //Assert
                    expect(patcher.get()).toEqual({a: {b: {c: {d: {e: 'changed'}}}}});
                    expect(spy).toHaveBeenCalledWith({ d: { e: 'changed' } }, expect.objectContaining({
                        "addedObjects": {}, "additions": {"d": {"e": "changed"}}, "deletions": {}, "differences": {"d": {"e": "changed"}}, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": false, "hasDifferences": true, "hasUpdates": false, "path": "a.b.c", "updates": {}
                    }), {}, isAggregated, {unkownKey: 'b'});
                });


                it('should notify of all object changes with apply when patch, deletion and override are used', () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd', e: 'f', g: { h: 'i', j: 'k' }}}});
                    const overrides = { 'a.b.c.g': true };
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    expect(spy).toHaveBeenCalledWith({ c: 'd', e: 'f', g: { h: 'i', j: 'k' }}, {snapshot: true}, {}, isAggregated);

                    //Act
                    patcher.apply({
                        a: {
                            b: {
                                e: 'patch',
                                c: patcher.options.deleteKeyword,
                                g: 5
                            }
                        }
                    }, '', {overrides});

                    //Assert
                    expect(patcher.get()).toEqual({a: {b: {e: 'patch', g: 5}}});
                    expect(spy).toHaveBeenCalledWith({ c: patcher.options.deleteKeyword, e: 'patch', g: 5}, expect.objectContaining({"addedObjects": {}, "additions": {}, "deletions": {"c": "d"}, "differences": {"c": "__$$D", "e": "patch", "g": 5}, "hasAddedObjects": false, "hasAdditions": false, "hasDeletions": true, "hasDifferences": true, "hasUpdates": true, "path": "a.b", "updates": {"e": {"newVal": "patch", "oldVal": "f"}, "g": {"newVal": 5, "oldVal": {"h": "i", "j": "k"}}}}), {}, isAggregated);
                });
            });

            describe('set', () => {
                it('should notify of object change with set on path', async () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd'}}});
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    expect(spy).toHaveBeenCalledWith({ c: 'd'}, {snapshot: true}, {}, isAggregated);

                    //Act
                    patcher.set({ e: 'f' }, 'a.b');

                    //Assert
                    expect(patcher.get()).toEqual({a: {b: {e: 'f'}}});
                    expect(spy).toHaveBeenCalledWith({ c: '__$$D', e: 'f'}, expect.objectContaining({"addedObjects": {}, "additions": {"e": "f"}, "deletions": {c: 'd'}, "differences": {"c": "__$$D", "e": "f"}, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
                });

                it('should notify of object change with apply on self (without path)', () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd'}}});
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    expect(spy).toHaveBeenCalledWith({ c: 'd'}, {snapshot: true}, {}, isAggregated);

                    //Act
                    patcher.set({a: {b: {e: 'f'}}});

                    //Assert
                    expect(patcher.get()).toEqual({a: {b: {e: 'f'}}});
                    expect(spy).toHaveBeenCalledWith({ c: '__$$D', e: 'f'}, expect.objectContaining({"addedObjects": {}, "additions": {"e": "f"}, "deletions": {c: 'd'}, "differences": {"c": "__$$D", "e": "f"}, "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
                });
            });

            describe('remove', () => {
                it('should notify of object change with remove on path', async () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd'}}});
                    const spy = jest.fn();
                    const isAggregated = false;

                    //Act
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    patcher.remove('a.b');

                    //Assert
                    expect(spy).toHaveBeenCalledWith({ c: 'd'}, {snapshot: true}, {}, isAggregated);
                    expect(patcher.get()).toEqual({a: {}});
                    expect(spy).toHaveBeenCalledWith('__$$D', expect.objectContaining({"deletions": {c: 'd'}, "differences": '__$$D', "hasAddedObjects": false, "hasAdditions": false, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false}), {}, isAggregated);
                });

                it('should notify of object change with remove on self (without path)', () => {
                    //Arrange
                    const patcher = new PatchDiff({a: {b: {c: 'd'}}});
                    const spy = jest.fn();
                    const isAggregated = false;
                    patcher.subscribe('a.b', (diff, changeInfo, context, isAggregated) => {
                        console.log('a.b', diff, changeInfo, context, isAggregated);
                        spy(diff, changeInfo, context, isAggregated);
                    });
                    expect(spy).toHaveBeenCalledWith({ c: 'd'}, {snapshot: true}, {}, isAggregated);

                    //Act
                    patcher.remove();

                    //Assert
                    expect(patcher.get()).toEqual({});
                    //todo: we are not getting any notification for deletion in this case
                    //expect(spy).toHaveBeenCalledWith(patcher.options.deleteKeyword, expect.objectContaining({"addedObjects": {}, "additions": {}, "deletions": {c: 'd'}, "differences": '__$$D', "hasAddedObjects": false, "hasAdditions": true, "hasDeletions": true, "hasDifferences": true, "hasUpdates": false, "path": "a.b", "updates": {}}), {}, isAggregated);
                });
            });
        });

        describe('Array change notifications', () => {
            it('should notify of all changes on a given path when underlying object is an Array', () => {
                //Arrange
                const patcher = new PatchDiff({ parent: ['a', 'b', { objArrItemProp: true }] });
                const spy = jest.fn();
                patcher.subscribe('parent[1]', (diff, changeInfo, context) => {
                    console.log('array change notification', diff, changeInfo, context);
                    spy(diff, changeInfo, context);
                });

                //Act
                patcher.apply(5, 'parent[1]');

                //Assert
                expect(spy).toHaveBeenCalledWith(5, { differences: 5, updates: { oldVal: 'b', newVal: 5 } }, {});
            });

            it('should notify on changes of multiple levels nested arrays and objects', () => {
                //Arrange
                const patcher = new PatchDiff({ parent: ['a', 'b', { objArrItemProp: ['c','d', { secondObjArrItemProp: ['awesome','stuff','really'] }] }] });
                const spy = jest.fn();
                const path = 'parent[2].objArrItemProp[2].secondObjArrItemProp[1]';
                patcher.subscribe(path, (diff, changeInfo, context) => {
                    console.log('array change notification', diff, changeInfo, context);
                    spy(diff, changeInfo, context);
                });

                //Act
                patcher.apply('fluff', path);

                //Assert
                expect(spy).toHaveBeenCalledWith('stuff', { snapshot: true }, {});
                expect(spy).toHaveBeenCalledWith('fluff', { differences: 'fluff', updates: { oldVal: 'stuff', newVal: 'fluff' } }, {});
            });
        });
    });
    describe('getWhenExists', () => {
        it('should resolve whenever a value is populated on a given path', () => {
            //Arrange
            const patcher = new PatchDiff();
            const promise = patcher.getWhenExists('a.b.c');

            //Act
            patcher.apply(5, 'a.b.c');

            //Assert
            return expect(promise).resolves.toEqual(5);
        });
    });
    describe('whenAnything', () => {
        it('should resolve whenever a non empty object is populated on a given path', () => {
            //Arrange
            const patcher = new PatchDiff();
            const promise = patcher.whenAnything('a.b.c');

            //Act
            patcher.apply({ key: 'value' }, 'a.b.c');

            //Assert
            return expect(promise).resolves.toEqual({ key: 'value' });
        });
        it.todo('test its not resolving when empty object is populated');
    });
    describe('at', () => {
        it('should return a fully operational PatchDiff sub object at given path', () => {
            //Arrange
            const patcher = new PatchDiff({
                a: {
                    b: {
                        c: 'd',
                        e: 'f'
                    }
                }
            });

            //Act
            const subPatcher = patcher.at('a.b');
            subPatcher.apply(5, 'c');
            subPatcher.remove('e');
            subPatcher.set({g: 'h'}, 'f');

            //Assert
            expect(patcher.get()).toEqual({a: {b: {c: 5, f: {g: 'h'}}}});
        });

        it('should cache sub patcher by default', () => {
            //Arrange
            const patcher = new PatchDiff({a: 1});

            //Act
            const subPatcher1 = patcher.at('a');
            const subPatcher2 = patcher.at('a');

            //Assert
            expect(subPatcher1).toBe(subPatcher2);
        });

        it('should allow to opt out of sub patcher caching', () => {
            //Arrange
            const patcher = new PatchDiff({a: 1});

            //Act
            const subPatcher1 = patcher.at('a', false);
            const subPatcher2 = patcher.at('a', false);

            //Assert
            expect(subPatcher1).not.toBe(subPatcher2);
        });

        it('should throw an error if non whitelisted path is being accessed', () => {
            //Arrange
            const patcher = new PatchDiff({
                a: {
                    b: {
                        c: 'd',
                        e: 'f'
                    }
                }
            });
            patcher.whitelist(['c']);

            //Act & Assert
            expect(() => patcher.at('a')).toThrowError('at(): path "a" is not allowed by whitelist');
            expect(() => patcher.at('c')).not.toThrowError();
        });
    });
    describe('whitelist', () => {
        it('should notify on whitelist additions and removals', () => {
            //Arrange
            const baseObject = {
                allowParent: 'a',
                allowParent2: 'b',
                allowParent3: 'c',
                allowParent4: 'd'
            };
            const patcher = new PatchDiff(baseObject);
            const spy = jest.fn();

            patcher.whitelist(['allowParent', 'allowParent2', 'allowParent3']);

            patcher.subscribe(spy);

            //Act
            patcher.whitelist(['allowParent', 'allowParent2', 'allowParent4']);

            //Assert
            const differences = { 'allowParent3': patcher.options.deleteKeyword, 'allowParent4': 'd' };
            const additions = { 'allowParent4': 'd' };
            const deletions = { 'allowParent3': 'c' };
            const completeEvent = {
                changeType: 'whitelist-change',
                additions,
                deletions,
                differences,
                hasAdditions: true,
                hasDeletions: true,
                hasDifferences: true
            };

            expect(spy).toBeCalledWith({
                allowParent: 'a',
                allowParent2: 'b',
                allowParent3: 'c',
            }, { snapshot: true }, {}, false, undefined);

            expect(spy).toBeCalledWith(differences, completeEvent, {}, false, undefined);
        });
    });

    describe('data proxy getter', () => {
        it('should return a proxy of self', async () => {
            //Arrange
            const patcher = new PatchDiff({a: 'b'});
            const proxy = patcher.data;

            //Act
            proxy.a = 'c';

            //Assert
            expect(patcher.get()).toEqual({a: 'c'});
        });
    });
});
