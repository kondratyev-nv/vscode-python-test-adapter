import * as path from 'path';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

import { empty, getTestOutputBySplittingString, groupBy } from '../utilities';

export function parseTestSuites(content: string, cwd: string): Array<TestSuiteInfo | TestInfo> {
    const allTests = getTestOutputBySplittingString(content, '==DISCOVERED TESTS BEGIN==')
        .split(/\r?\n/g)
        .map(line => line.trim())
        .map(line => line.replace(/::\(\)/g, ''))
        .filter(line => line)
        .map(line => splitModule(line, cwd))
        .filter(line => line)
        .map(line => line!);
    return Array.from(groupBy(allTests, t => t.modulePath).entries())
        .map(([modulePath, tests]) => ({
            type: 'suite' as 'suite',
            id: modulePath,
            label: path.basename(modulePath),
            file: modulePath,
            children: toTestSuites(tests.map(t => ({ head: t.modulePath, tail: t.testPath }))),
        }));
}

function toTestSuites(tests: Array<{ head: string, tail: string }>): Array<TestSuiteInfo | TestInfo> {
    if (empty(tests)) {
        return [];
    }
    const testsAndSuites = groupBy(tests, t => t.tail.includes('::'));
    return (toFirstLevelTests(testsAndSuites.get(false)) as Array<TestSuiteInfo | TestInfo>)
        .concat(toSuites(testsAndSuites.get(true)) as Array<TestSuiteInfo | TestInfo>);
}

function toSuites(suites: Array<{ head: string, tail: string }> | undefined): TestSuiteInfo[] {
    if (!suites) {
        return [];
    }
    return Array.from(groupBy(suites.map(test => splitTest(test)), group => group.head).entries())
        .map(([suite, suiteTests]) => ({
            type: 'suite' as 'suite',
            id: suite,
            label: suiteTests[0].name,
            file: suite,
            children: toTestSuites(suiteTests),
        }));
}

function toFirstLevelTests(tests: Array<{ head: string, tail: string }> | undefined): TestInfo[] {
    if (!tests) {
        return [];
    }
    return tests.map(test => ({
        id: `${test.head}::${test.tail}`,
        label: test.tail,
        type: 'test' as 'test',
    }));
}

function splitTest(test: { head: string, tail: string }) {
    const separatorIndex = test.tail.indexOf('::');
    return {
        head: `${test.head}::${test.tail.substring(0, separatorIndex)}`,
        tail: test.tail.substring(separatorIndex + 2),
        name: test.tail.substring(0, separatorIndex),
    };
}

function splitModule(testId: string, cwd: string) {
    const separatorIndex = testId.indexOf('::');
    if (separatorIndex < 0) {
        return null;
    }
    return {
        modulePath: path.resolve(cwd, testId.substring(0, separatorIndex)),
        testPath: testId.substring(separatorIndex + 2),
    };
}
