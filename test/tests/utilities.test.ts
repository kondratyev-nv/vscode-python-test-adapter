import { expect } from 'chai';
import 'mocha';
import { setDescriptionForEqualLabels } from '../../src/utilities/tests';
import { startsWith, concatNonEmpty } from '../../src/utilities/strings';

suite('Description for equal labels', async () => {
    test('should not be set for tests with distinctive labels', async () => {
        const suites = [
            {
                id: 'some.module1.SomeTest1',
                label: 'SomeTest1',
            },
            {
                id: 'some.module2.SomeTest2',
                label: 'SomeTest2',
            },
        ];

        setDescriptionForEqualLabels(suites, '.');
        expect(suites).to.be.deep.equal([
            {
                id: 'some.module1.SomeTest1',
                label: 'SomeTest1',
            },
            {
                id: 'some.module2.SomeTest2',
                label: 'SomeTest2',
            },
        ]);
    });

    test('should be set for tests with same labels', async () => {
        const suites = [
            {
                id: 'some.module1.SomeTest',
                label: 'SomeTest',
            },
            {
                id: 'some.module2.SomeTest',
                label: 'SomeTest',
            },
        ];

        setDescriptionForEqualLabels(suites, '.');
        expect(suites).to.be.deep.equal([
            {
                id: 'some.module1.SomeTest',
                label: 'SomeTest',
                description: 'module1',
            },
            {
                id: 'some.module2.SomeTest',
                label: 'SomeTest',
                description: 'module2',
            },
        ]);
    });

    test('should not modify description for tests when label is not a part of id', async () => {
        const suites = [
            {
                id: 'some.module1.SomeTest',
                label: 'SomeTest',
            },
            {
                id: 'some.module2.SomeTest',
                label: 'SomeTest',
            },
            {
                id: 'some.module3.SomeTest',
                label: 'Error in module3.py',
            },
        ];

        setDescriptionForEqualLabels(suites, '.');
        expect(suites).to.be.deep.equal([
            {
                id: 'some.module1.SomeTest',
                label: 'SomeTest',
                description: 'module1',
            },
            {
                id: 'some.module2.SomeTest',
                label: 'SomeTest',
                description: 'module2',
            },
            {
                id: 'some.module3.SomeTest',
                label: 'Error in module3.py',
            },
        ]);
    });
});

suite('String utilities - startsWith', async () => {
    test('should return true for substring with offset', async () => {
        expect(startsWith('abcdef', 'cd', 2)).to.be.true;
    });

    test('should return true for the beginning of the string', async () => {
        expect(startsWith('abcdef', 'abc')).to.be.true;
    });

    test('should return false for invalid offet', async () => {
        expect(startsWith('abcdef', 'cd', 1)).to.be.false;
        expect(startsWith('abcdef', 'cd', 3)).to.be.false;
    });
});

suite('String utilities - concatNonEmpty', async () => {
    test('should filter empty strings', async () => {
        expect(concatNonEmpty('.', 'ab', '', '', 'cd', 'e', '', 'f', '')).to.be.eq('ab.cd.e.f');
        expect(concatNonEmpty('.', '', '', 'ab', 'cd', 'e', '', 'f', '')).to.be.eq('ab.cd.e.f');
    });

    test('should return empty string for empty strings', async () => {
        expect(concatNonEmpty('.', '', '', '', '')).to.be.empty;
    });
});
