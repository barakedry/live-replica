const DiffTracker = require('../src/diff-tracker.js');

describe('Diff Tracker', () => {
    describe('create', () => {
        it('should create a new DiffTracker Instance on every call', () => {
            //Act
            const diff1 = DiffTracker.create();
            const diff2 = DiffTracker.create();

            //Assert
            expect(diff1).not.toBe(diff2);
        });

        it('should create a clean state tracker', () => {
            //Act
            const diff = DiffTracker.create();

            //Assert
            expect(diff).toMatchObject({
                hasAdditions: false,
                hasDeletions: false,
                hasUpdates: false,
                hasDifferences: false,
                additions: {},
                deletions: {},
                updates: {},
                differences: {}
            });
            expect(typeof diff.addChildTracking).toBe('function');
        });
    });

    describe('addChildTracking', () => {
        it.todo('future tests');
    });
});
