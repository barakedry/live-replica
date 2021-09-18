const PatchDiff = require('../index');

describe('Patch Diff', () => {
    describe('options', () => {
        describe('maxLevels', () => {
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
                patcher.apply({1: {2: {3: {4: { 5: '5th level'}}}}});
            });
        });
    });

    describe('apply', () => {
        describe('With no base object', () => {
            describe('All value types can be applied', () => {
                it.each`
              key           | value                      | expectedObject 
              ${'string'}   | ${'string'}                | ${{string: 'string'}}
              ${'number'}   | ${5}                       | ${{number: 5}}
              ${'boolean'}  | ${true}                    | ${{boolean: true}}
              ${'object'}   | ${{ hello: 'world' }}      | ${{object: { hello: 'world' }}}
            `('should apply $key', ({key, value, expectedObject}) => {
                    //Arrange
                    const patcher = new PatchDiff();

                    //Act
                    patcher.apply({[key]: value});

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
              test          | key           | value                                       | expectedObject 
              ${'string'}   | ${'string'}   | ${'string'}                                 | ${{string: 'string'}}
              ${'number'}   | ${'number'}   | ${5}                                        | ${{string: 'string', number: 5}}
              ${'boolean'}  | ${'boolean'}  | ${true}                                     | ${{string: 'string', number: 5, boolean: true}}
              ${'object'}   | ${'object'}   | ${{ hello: 'world' }}                       | ${{string: 'string', number: 5, boolean: true, object: { hello: 'world' }}}
              ${'nested'}   | ${'nested'}   | ${{ hello: { world: { print: 'end'}}}}      | ${{string: 'string', number: 5, boolean: true, object: { hello: 'world' }, nested: { hello: { world: { print: 'end'}}} }}}
            `('should apply addition of $test property', ({key, value, expectedObject}) => {
                    //Act
                    patcher.apply({[key]: value});

                    //Assert
                    expect(patcher.get()).toEqual(expectedObject);
                });
            });

            describe('apply primitive at path', () => {
                it('should update value at given path', () => {
                    //Arrange
                    const patcher = new PatchDiff({ a: 'b' });
                    const path = 'a';

                    //Act
                    patcher.apply(5, path);

                    //Assert
                    expect(patcher.get()).toEqual({ a: 5 });
                });
            });

            describe('No patch or path', () => {
                it('should ', () => {
                    //Arrange
                    const patcher = new PatchDiff({ a: 'b' });
                    jest.spyOn(patcher, '_applyObject');

                    //Act
                    patcher.apply();

                    //Assert
                    expect(patcher._applyObject).not.toBeCalled();
                    expect(patcher.get()).toEqual({ a: 'b' });
                });
            });
        });
    });
    describe('set', () => {
        it.todo('future');
    });
    describe('remove', () => {
        it.todo('future');
    });
    describe('splice', () => {
        it.todo('future');
    });
    describe('get', () => {
        it.todo('future');
    });
    describe('getClone', () => {
        it.todo('future');
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
        it.todo('future');
    });
});
