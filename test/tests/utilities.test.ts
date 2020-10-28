import { expect } from 'chai';
import 'mocha';
import { setDescriptionForEqualLabels } from '../../src/utilities/tests';

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
            }
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
            }
        ])
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
            }
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
            }
        ])
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
            }
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
            }
        ])
    });
});