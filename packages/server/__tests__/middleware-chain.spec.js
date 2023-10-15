/*global describe: false, it: false */
'use strict';

import MiddlewareChain from '../src/middleware-chain.js';

describe.skip('MiddlewareChain', () => {

    describe('no middlewares', function () {
        const chain = new MiddlewareChain();
        describe('call start() without parameters', function () {
            it('finish callback should have no arguments', function (done) {
                chain.start(function finish() {
                    assert.lengthOf(arguments, 0, 'arguments length should be zero');
                    done();
                });
            });
        });

        describe('call start() with parameters (2)', function () {
            const param1 = {test: true};
            const param2 = {counter: 0};
            chain.start(param1, param2, function finish(a, b) {
                const args = arguments;
                describe('finish callback', function () {

                    it('should have 2 arguments', function () {
                        assert.lengthOf(args, 2, 'arguments length is 2');
                    });

                    it('first argument should be param1 of start method', function () {
                        assert.equal(a, param1, 'first argument is equal to param');
                    });

                    it('second argument should be param2 of start method', function () {
                        assert.equal(b, param2, 'first argument is equal to param');
                    });
                });
            });
        });
    });


    describe('with 1 middleware', function () {

        describe('call start() without parameters', function () {
            //setup
            const chain = new MiddlewareChain();

            chain.add(function (next) {
                const args = arguments;
                describe('middleware called', function () {
                    it('should have 1 argument', function () {
                        assert.lengthOf(args, 1, 'arguments length is 1');
                    });

                    it('last argument should be the "next" function', function () {
                        assert.typeOf(args[args.length - 1], 'function', 'is a function');
                        assert.equal(args[args.length - 1].name, 'next', 'name is next');
                    });
                });

                next();
            });


            chain.start(function finish() {
                const args = arguments;
                describe('finish callback', function () {
                    it('should have no arguments', function () {
                        assert.lengthOf(args, 0, 'arguments length is zero');
                    });
                });
            });
        });

        describe('call start() with parameters (2)', function () {

            //setup
            const chain = new MiddlewareChain();
            const param1 = {test: true};
            const param2 = {counter: 0};

            chain.add(function (a, b, next) {
                const args = arguments;
                describe('middleware 1 called', function () {
                    it('should have 3 arguments', function () {
                        assert.lengthOf(args, 3, 'arguments length is 3');
                    });

                    it('first argument should be param1 of start method', function () {
                        assert.equal(a, param1, 'first argument is equal to param');
                    });

                    it('second argument should be param2 of start method', function () {
                        assert.equal(b, param2, 'first argument is equal to param');
                    });

                    it('last argument should be the "next" function', function () {
                        assert.typeOf(args[args.length - 1], 'function', 'is a function');
                        assert.equal(args[args.length - 1].name, 'next', 'name is next');
                    });
                });

                // modify
                a.test = 'modified';
                b.counter++;
                next();
            });


            chain.start(param1, param2, function finish(a, b) {
                const args = arguments;
                describe('finish callback', function () {

                    it('should have 2 arguments', function () {
                        assert.lengthOf(args, 2, 'arguments length is 2');
                    });

                    it('first argument should be param1 of start method', function () {
                        assert.equal(a, param1, 'first argument is equal to param');
                    });

                    it('second argument should be param2 of start method', function () {
                        assert.equal(b, param2, 'first argument is equal to param');
                    });

                    it('value of param1.test should be "modified"', function () {
                        assert.equal(param1.test, 'modified', 'parameter.test is "modified"');
                    });

                    it('value of param2.counter should be 1', function () {
                        assert.equal(param2.counter, 1, 'parameter.test is 1');
                    });
                });
            });
        });
    });


    describe('with 2 middlewares', function () {

        describe('call start() without parameters', function () {
            //setup
            const chain = new MiddlewareChain();

            chain.add(function (next) {
                const args = arguments;
                describe('middleware 1 called', function () {
                    it('should have 1 argument', function () {
                        assert.lengthOf(args, 1, 'arguments length is 1');
                    });

                    it('last argument should be the "next" function', function () {
                        assert.typeOf(args[args.length - 1], 'function', 'is a function');
                        assert.equal(args[args.length - 1].name, 'next', 'name is next');
                    });

                    // call deferred
                    setTimeout(next, 10);
                });
            });

            describe('middleware 2 called (deferred)', function () {
                chain.add(function (next) {
                    const args = arguments;


                    it('should have 1 argument', function () {
                        assert.lengthOf(args, 1, 'arguments length is 1');
                    });

                    it('last argument should be the "next" function', function () {
                        assert.typeOf(args[args.length - 1], 'function', 'is a function');
                        assert.equal(args[args.length - 1].name, 'next', 'name is next');
                    });

                    next();
                });
            });


            chain.start(function finish() {
                const args = arguments;
                describe('finish callback', function () {
                    it('should have no arguments', function () {
                        assert.lengthOf(args, 0, 'arguments length is zero');
                    });
                });
            });
        });

        describe('call start() with parameters (2)', function () {

            //setup
            const chain = new MiddlewareChain();
            const param1 = {test: true};
            const param2 = {counter: 0};

            chain.add(function (a, b, next) {
                const args = arguments;
                describe('middleware 1 called', function () {
                    it('should have 3 arguments', function () {
                        assert.lengthOf(args, 3, 'arguments length is 3');
                    });

                    it('first argument should be param1 of start method', function () {
                        assert.equal(a, param1, 'first argument is equal to param');
                    });

                    it('second argument should be param2 of start method', function () {
                        assert.equal(b, param2, 'first argument is equal to param');
                    });

                    it('last argument should be the "next" function', function () {
                        assert.typeOf(args[args.length - 1], 'function', 'is a function');
                        assert.equal(args[args.length - 1].name, 'next', 'name is next');
                    });
                });

                // modify
                a.test = 'modified';
                b.counter++;
                setTimeout(next, 10);
            });

            chain.add(function (a, b, next) {
                const args = arguments;
                describe('middleware 2 called (deferred)', function () {
                    it('should have 3 arguments', function () {
                        assert.lengthOf(args, 3, 'arguments length is 3');
                    });

                    it('first argument should be param1 of start method', function () {
                        assert.equal(a, param1, 'first argument is equal to param');
                    });

                    it('second argument should be param2 of start method', function () {
                        assert.equal(b, param2, 'first argument is equal to param');
                    });

                    it('last argument should be the "next" function', function () {
                        assert.typeOf(args[args.length - 1], 'function', 'is a function');
                        assert.equal(args[args.length - 1].name, 'next', 'name is next');
                    });
                });

                // modify
                a.test += ' twice';
                b.counter++;
                next();
            });

            chain.start(param1, param2, function finish(a, b) {
                const args = arguments;
                describe('finish callback (deferred)', function () {

                    it('should have 2 arguments', function () {
                        assert.lengthOf(args, 2, 'arguments length is 2');
                    });

                    it('first argument should be param1 of start method', function () {
                        assert.equal(a, param1, 'first argument is equal to param');
                    });

                    it('second argument should be param2 of start method', function () {
                        assert.equal(b, param2, 'first argument is equal to param');
                    });

                    it('value of param1.test should be "modified twice"', function () {
                        assert.equal(param1.test, 'modified twice', 'parameter.test is "modified twice"');
                    });

                    it('value of param2.counter should be 2', function () {
                        assert.equal(param2.counter, 2, 'parameter.test is 2');
                    });
                });
            });
        });
    });
});