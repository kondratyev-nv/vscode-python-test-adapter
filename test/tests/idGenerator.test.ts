import { expect } from 'chai';
import 'mocha';

import { nextId } from '../../src/idGenerator';

function hasDuplicates<T>(values: T[]) {
    return (new Set<T>(values)).size !== values.length;
}

suite('Id generator', () => {
    test('should generate multiple unique ids', () => {
        const values = [];
        for (let i = 0; i < 1_000_000; i++) {
            values.push(nextId());
        }
        expect(hasDuplicates(values)).to.be.false;
    });
});
