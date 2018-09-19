import { Base64 } from 'js-base64';
import * as path from 'path';
import { TestEvent, TestSuiteInfo } from 'vscode-test-adapter-api';

export function parseTestSuites(output: string, cwd: string): TestSuiteInfo[] {
    const allTests = getTestOutputBySplittingString(output, '==DISCOVERED TESTS==')
        .split(/\r?\n/g)
        .map(line => line.trim())
        .filter(line => line)
        .map(line => splitTestId(line))
        .filter(line => line)
        .map(line => line!);
    return Array.from(groupBy(allTests, t => t.suitId).entries())
        .map(([suitId, tests]) => ({
            type: 'suite' as 'suite',
            id: suitId,
            label: suitId.substring(suitId.lastIndexOf('.') + 1),
            file: filePathBySuitId(cwd, suitId),
            children: tests.map(test => ({
                id: test.testId,
                label: test.testLabel,
                type: 'test' as 'test',
            })),
        }));
}

export function parseTestStates(output: string): TestEvent[] {
    return getTestOutputBySplittingString(output, '==TEST RESULTS==')
        .split(/\r?\n/g)
        .map(line => line.trim())
        .filter(line => line)
        .map(line => tryParseTestState(line))
        .filter(line => line)
        .map(line => line!);
}

function tryParseTestState(line: string): TestEvent | undefined {
    const [result, testId, base64Message = ''] = line.split(':');
    if (result == null || testId == null) {
        return undefined;
    }
    const state = toState(result.trim());
    if (!state) {
        return undefined;
    }
    return {
        type: 'test',
        test: testId.trim(),
        state,
        message: base64Message ? Base64.decode(base64Message.trim()) : undefined,
    };
}

function getTestOutputBySplittingString(output: string, stringToSplitWith: string): string {
    const split = output.split(stringToSplitWith);
    return split && split.pop() || '';
}

function toState(value: string): 'running' | 'passed' | 'failed' | 'skipped' | undefined {
    switch (value) {
        case 'running':
        case 'passed':
        case 'failed':
        case 'skipped':
            return value;
        default:
            return undefined;
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
}

function splitTestId(testId: string) {
    const separatorIndex = testId.lastIndexOf('.');
    if (separatorIndex < 0) {
        return null;
    }
    return {
        suitId: testId.substring(0, separatorIndex),
        testId,
        testLabel: testId.substring(separatorIndex + 1),
    };
}

function filePathBySuitId(cwd: string, suitId: string) {
    const separatorIndex = suitId.lastIndexOf('.');
    if (separatorIndex < 0) {
        return undefined;
    }
    return path.resolve(cwd, suitId.substring(0, separatorIndex).split('.').join('/') + '.py');
}
