/**
 * Created by barakedry on 6/21/15.
 */
/*global describe: false, it: false */
'use strict';

var PatchDiff = require('../index');
var chai = require('chai');
var assert = chai.assert;
var extend = require('node.extend');
var EventEmitterEnhancer = require('event-emitter-enhancer');

describe('apply-diff', function () {
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
        it('add', function () {
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
