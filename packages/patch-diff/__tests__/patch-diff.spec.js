import PatchDiff from '../src/patch-diff.js';

beforeEach(() => {
    jest.resetAllMocks();
});

describe('Patch Diff', () => {
    describe('apply', () => {
        describe('Bad path', () => {
            it('should emit error when max levels exceeded and not apply any further levels', (done) => {
                //Arrange
                const patcher = new PatchDiff(null, {maxLevels: 2});
                patcher.on('error', (error) => {
                    //Assert
                    expect(error).toEqual(new Error('Trying to apply too deep, stopping at level 3'));
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
                /*
                    BUG: whitelist is not working
                    ReferenceError: fullPath is not defined
                        at Object.fullPath (/Projects/live-replica/packages/utils/utils.js:134:36)
                        at PatchDiff.firstKey [as apply] (/Projects/live-replica/packages/patch-diff/src/patch-diff.js:74:48)
                        at Object.apply (/Projects/live-replica/packages/patch-diff/__tests__/patch-diff.spec.js:50:29)
                 */
                it.failing('should not modify non whitelisted paths', () => {
                    //Arrange
                    const baseObject = {
                        allowParent: 'b',
                        disallow: { child: { allowChild: 'c' }},
                        c: { d: 4 },
                        d: 'e'
                    };
                    const patcher = new PatchDiff(baseObject);
                    patcher.whitelist(['allowParent','disallow.child.allowChild']);

                    //Act
                    patcher.apply(5, 'c.d');

                    //Assert
                    expect(patcher.get()).toEqual({
                        allowParent: 'b',
                        disallow: { child: { allowChild: 'c' }},
                        c: { d: 4 },
                        d: 'e'
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

            it.todo('apply -> options.overrides');
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
        it.todo('future');
    });
    describe('splice', () => {
        it.todo('future');
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
    });
    describe('on', () => {
        it.todo('future');
    });
    describe('subscribe', () => {
        it.todo('future');
    });
    describe('getWhenExists', () => {
        it.todo('future');
    });
    describe('whenAnything', () => {
        it.todo('future');
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
    });
});

describe.skip('PatchDiff-deprecated', function () {
    function createBaseObject() {
        return {
            string: 'string',
            number: 5,
            boolean: true,
            array: [0, 1, '2', false, {
                prop: 'val'
            }],
            obj: {
                property: 'value1',
                property2: 'value2'
            },
            nested: {
                a: {
                    b: {
                        c: {
                            d: {
                                property: 'value1',
                                property2: 'value2'
                            }
                        }
                    }
                }
            }
            /*
             func: function () {
             return "hello";
             }
             */
        };
    }

    function createSmallObject() {
        return {
            new1: 'yes',
            new2: {
                myobj: true
            }
        };
    }

    describe('apply', function () {
        describe('merging the number 20 to the path "string"', function () {

            var patcher = new PatchDiff(createBaseObject());
            var expectedObject = createBaseObject();

            expectedObject.string = 20;

            it('merged object should be the same as expected object', function () {
                patcher.apply(20, 'string');
                assert.deepEqual(patcher._data, expectedObject);
            });

        });

        describe('merging the string "test" to 3 existing properties with no path (to root)', function () {

            var patcher = new PatchDiff(createBaseObject());
            var originalObject = createBaseObject();

            it('merged object should be the same as expected object', function () {

                patcher.apply({
                    string: 'test',
                    boolean: 'test',
                    number: 'test'
                });

                assert.equal(patcher._data.string, 'test');
                assert.equal(patcher._data.boolean, 'test');
                assert.equal(patcher._data.number, 'test');
                assert.notEqual(patcher._data.array, 'test');
                assert.deepEqual(patcher._data.nested, originalObject.nested);
            });

        });

        describe('merging 2 string properties and a new object with no path (to root)', function () {

            var patcher = new PatchDiff(createBaseObject());

            it('merged object should be the same as expected object', function () {

                patcher.apply({
                    string: 'test',
                    boolean: false,
                    newobject: {
                        test: 'test'
                    }
                });

                assert.equal(patcher.get('string'), 'test');
                assert.equal(patcher._data.boolean, false);
                assert.deepEqual(patcher._data.newobject, {
                    test: 'test'
                });
            });

        });

        describe('merging 4 items to array existing, modified, new and deleted', function () {

            var patcher = new PatchDiff(createBaseObject());

            it('1 item should be modified 1 deleted and one added', function () {

                patcher.on('array', function (diff) {
                    assert.deepEqual(diff.differences, {
                        2: 'test',
                        4: patcher.options.deleteKeyword,
                        7: 'test2'
                    });
                });

                patcher.apply({
                    array: {
                        1: 1,
                        2: 'test',
                        4: patcher.options.deleteKeyword,
                        7: 'test2'
                    }
                });

                //[0, 1, '2', false, {prop: 'val'}]
                //[0, 1, 'test', false, null, null, 'test2]

                assert.deepEqual(patcher._data.array, [0, 1, 'test', false, , , 'test2']);
            });

        });

        describe('remove a string and boolean', function () {

            let patcher = new PatchDiff(createBaseObject());

            it('merged object should be the same as expected object', function () {

                patcher.apply({
                    boolean: patcher.options.deleteKeyword,
                    string: patcher.options.deleteKeyword
                });

            });

        });

        describe('apply nested object to "nested.a"', function () {

            var patcher = new PatchDiff(createBaseObject());

            it('merged object should be the same as expected object', function () {

                // patcher.on('nested', function (diff) {
                patcher.on('nested', function () {
                    //console.log('diff', diff.differences);
                    return undefined;
                });

                patcher.apply({
                    b: {
                        added: 'asd',
                        c: {
                            d: {
                                property2: undefined
                            }
                        }
                    }
                }, 'nested.a');

                //[0, 1, '2', false, {prop: 'val'}]
                //[0, 1, 'test', false, null, null, 'test2]

                //expect(patcher._data).property('array').to.deep.equal([0, 1, 'test', false, undefined, undefined, 'test2']);
            });

        });

        describe('nested', function () {
            it('change 1 nested object', function () {
                var patcher = new PatchDiff(createBaseObject());
                var expectedObject = createBaseObject();
                extend(true, expectedObject.nested.a.b.c, createSmallObject());

                var generalEvent = false;
                patcher.on('nested', function () {
                    if (generalEvent) {
                        assert.fail();
                    }
                    generalEvent = true;
                });

                patcher.apply(createSmallObject(), 'nested.a.b.c');

                assert.deepEqual(patcher._data, expectedObject);
                assert.isTrue(generalEvent);

                patcher.apply(createSmallObject(), 'nested.a.b.c');

                assert.deepEqual(patcher._data, expectedObject);
            });
        });
    });

    describe('override', function () {
        describe('nested', function () {
            it('override top level', function () {
                var patcher = new PatchDiff(createBaseObject());
                var expectedObject = createBaseObject();
                delete expectedObject.number;
                expectedObject.number = createSmallObject();

                var generalEvent = false;
                patcher.on('number', function () {
                    if (generalEvent) {
                        assert.fail();
                    }
                    generalEvent = true;
                });

                patcher.override(createSmallObject(), 'number');

                assert.deepEqual(patcher._data, expectedObject);
                assert.isTrue(generalEvent);

                patcher.override(createSmallObject(), 'number');

                assert.deepEqual(patcher._data, expectedObject);
            });

            it('override 1 nested object', function () {
                var patcher = new PatchDiff(createBaseObject());
                var expectedObject = createBaseObject();
                delete expectedObject.nested.a.b.c;
                expectedObject.nested.a.b.c = createSmallObject();

                patcher.override(createSmallObject(), 'nested.a.b.c');

                assert.deepEqual(patcher._data, expectedObject);
            });

            it('override array', function () {
                var patcher = new PatchDiff({});
                var expectedObject = createBaseObject();

                patcher.override(createBaseObject(), '');

                assert.deepEqual(patcher._data, expectedObject);
            });
        });
    });

    describe('remove', function () {
        describe('primitives', function () {
            it('remove 1 primitive', function () {
                var patcher = new PatchDiff(createBaseObject());
                var expectedObject = createBaseObject();
                delete expectedObject.number;

                var generalEvent = false;
                patcher.on('*', function () {
                    if (generalEvent) {
                        assert.fail();
                    }
                    generalEvent = true;
                });


                patcher.remove('number');

                assert.deepEqual(patcher._data, expectedObject);
                assert.isTrue(generalEvent);

                patcher.remove('number');

                assert.deepEqual(patcher._data, expectedObject);
            });
        });

        describe('nested', function () {
            it('remove 1 nested object', function () {
                var patcher = new PatchDiff(createBaseObject());
                var expectedObject = createBaseObject();
                delete expectedObject.nested.a.b.c;

                patcher.remove('nested.a.b.c');

                assert.deepEqual(patcher._data, expectedObject);
            });
        });
    });

    describe('differences events', function () {
        it.skip('add', function () {
            var patcher = new PatchDiff({}, {
                pathEventPrefix: 'TEST:'
            });

            var expectedEvents = [
                '*',
                'subObject',
                'subObject.sub2'
            ];

            EventEmitterEnhancer.modifyInstance(patcher);
            patcher.else(function (event) {
                if (expectedEvents.indexOf(event) !== -1) {
                    expectedEvents.splice(expectedEvents.indexOf(event), 1);
                } else {
                    assert.fail(event);
                }
            });

            patcher.apply({
                key: 1,
                subObject: {
                    key: 2,
                    sub2: {
                        key: 3
                    }
                }
            });

            assert.equal(0, expectedEvents.length);
        });
    });
});
