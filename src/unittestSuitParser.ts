import * as path from 'path';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

export const ALL_TESTS_SUIT_ID = 'ALL_DISCOVERED_TESTS';

export function parseTestSuits(output: string, cwd: string): TestSuiteInfo {
    const allTests = output.split(/\r?\n/g)
        .map(line => line.trim())
        .filter(line => line)
        .map(line => splitTestId(line));
    const suits = Array.from(groupBy(allTests, t => t.suitId).entries())
        .map(([suitId, tests]) => <TestSuiteInfo>{
            type: 'suite',
            id: suitId,
            label: suitId.substring(suitId.lastIndexOf(".") + 1),
            file: filePathBySuitId(cwd, suitId),
            children: tests.map(test => <TestInfo>{
                type: 'test',
                id: test.testId,
                label: test.testLabel
            })
        });
    return {
        type: 'suite',
        id: ALL_TESTS_SUIT_ID,
        label: 'All tests',
        children: suits
    }
}

function groupBy<T, U>(values: T[], key: (v: T) => U) {
    return values.reduce((accumulator, x) => {
        if (accumulator.has(key(x))) {
            accumulator.get(key(x))!.push(x);
        } else {
            accumulator.set(key(x), [x]);
        }
        return accumulator;
    }, new Map<U, T[]>());
};

function splitTestId(testId: string) {
    return {
        testId: testId,
        testLabel: testId.substring(testId.lastIndexOf(".") + 1),
        suitId: testId.substring(0, testId.lastIndexOf("."))
    }
}

function filePathBySuitId(cwd: string, suitId: string) {
    return path.resolve(
        cwd,
        suitId.substring(0, suitId.lastIndexOf(".")).split('.').join('/') + '.py')
}
