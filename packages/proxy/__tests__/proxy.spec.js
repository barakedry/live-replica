import PatchDiff from '../../patch-diff/src/patch-diff.js';
import {Replica as LiveReplica, get} from "../../../index";

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

            //Assert
            expect(patcher.get()).toEqual({a: 'b', b: 'd'});
        });

        it('should be able to delete object property', async () => {
            //Arrange
            const patcher = new PatchDiff({a: 'b'});
            const patcherProxy = patcher.getData();

            //Act
            delete patcherProxy.a;

            //Assert
            expect(patcher.get()).toEqual({});
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
        // const dataProxy = LiveReplica.create({
        //     foo: {
        //         bar: 'baz'
        //     }
        // });
        //
        // get(dataProxy, 'foo.bar'); // returns 'baz'
        //
        // set(dataProxy, 'foo.bar', 'qux'); // sets 'qux' to 'foo.bar'
        //
        // merge(dataProxy, 'foo', { bar: 'qux' }); // merges { bar: 'qux' } to 'foo'

        it('should ', () => {
            //Arrange
            const dataProxy = LiveReplica.create({
                foo: {
                    bar: 'baz'
                }
            });

            //Act
            const result = get(dataProxy, 'foo.bar');

            //Assert
            expect(result).toEqual('baz');
        });

    });
});
