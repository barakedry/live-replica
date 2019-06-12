/**
 * Created by barakedry on 6/21/15.
 */
/*global describe: false, it: false */
'use strict';


const chai = require('chai');
const assert = chai.assert;
const PatchDiff = require('../../patch-diff');

const {
    LiveReplicaPersistence,
    LiveReplicaFilePersistence,
    LiveReplicaMongoDbPersistence
} = require('../persistency.js');

describe('LiveReplicaPersistence', function () {
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

    describe('constructing a LiveReplicaPersistence object', function () {
        describe('construct without parameters', function () {
            it('should throw an error ', function () {
                try {
                    const lrp = new LiveReplicaPersistence();
                } catch (e) {

                }

            });
        });

        describe('construct without a query parameter', function () {
            const lrp = new LiveReplicaPersistence();
        });

        describe('construct with a non replica (PatchDiff) parameter as the first parameter', function () {

        });

        describe('construct with proper replica (PatchDiff) and query parameters', function () {

        });
    });

    describe('LiveReplicaPersistence.load()', function () {
        describe('load non-existing record/file to the replica', function () {
            it('should throw an error', function () {


                //patcher.apply(20, 'string');
                //assert.deepEqual(patcher._data, expectedObject);
            });
        });

        describe('load something that does not exists', function () {
            it('merged object should be the same as expected object', function () {
                patcher.apply(20, 'string');
                assert.deepEqual(patcher._data, expectedObject);
            });
        });
    });

    describe('LiveReplicaPersistence.persist()', function () {

    });

    describe('LiveReplicaPersistence.persistOnChange()', function () {

    });

    describe('LiveReplicaPersistence.deleteRecord()', function () {

    });

});
