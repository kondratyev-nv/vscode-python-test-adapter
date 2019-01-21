import * as path from 'path';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

import { empty, groupBy } from '../utilities';

const DISCOVERED_TESTS_START_MARK = '==DISCOVERED TESTS BEGIN==';
const DISCOVERED_TESTS_END_MARK = '==DISCOVERED TESTS END==';

export function parseTestSuites(content: string, cwd: string): Array<TestSuiteInfo | TestInfo> {
    const from = content.indexOf(DISCOVERED_TESTS_START_MARK);
    const to = content.indexOf(DISCOVERED_TESTS_END_MARK);
    const discoveredTestsJson = content.substring(from + DISCOVERED_TESTS_START_MARK.length, to);
    const allTests = (JSON.parse(discoveredTestsJson) as Array<{ id: string, line: number }>)
        .map(line => ({ ...line, id: line.id.replace(/::\(\)/g, '') }))
        .filter(line => line.id)
        .map(line => splitModule(line, cwd))
        .filter(line => line)
        .map(line => line!);
    return Array.from(groupBy(allTests, t => t.modulePath).entries())
        .map(([modulePath, tests]) => ({
            type: 'suite' as 'suite',
            id: modulePath,
            label: path.basename(modulePath),
            file: modulePath,
            children: toTestSuites(tests.map(t => ({ head: t.modulePath, tail: t.testPath, line: t.line, path: modulePath }))),
        }));
}

function toTestSuites(tests: Array<{ head: string, tail: string, line: number, path: string }>): Array<TestSuiteInfo | TestInfo> {
    if (empty(tests)) {
        return [];
    }
    const testsAndSuites = groupBy(tests, t => t.tail.includes('::'));
    const firstLevelTests: Array<TestSuiteInfo | TestInfo> = toFirstLevelTests(testsAndSuites.get(false));
    const suites: Array<TestSuiteInfo | TestInfo> = toSuites(testsAndSuites.get(true));
    return firstLevelTests.concat(suites);
}

function toSuites(suites: Array<{ head: string, tail: string, line: number, path: string }> | undefined): TestSuiteInfo[] {
    if (!suites) {
        return [];
    }
    return Array.from(groupBy(suites.map(test => splitTest(test)), group => group.head).entries())
        .map(([suite, suiteTests]) => ({
            type: 'suite' as 'suite',
            id: suite,
            label: suiteTests[0].name,
            file: suiteTests[0].path,
            children: toTestSuites(suiteTests),
        }));
}

function toFirstLevelTests(tests: Array<{ head: string, tail: string, path: string, line: number }> | undefined): TestInfo[] {
    if (!tests) {
        return [];
    }
    return tests.map(test => ({
        id: `${test.head}::${test.tail}`,
        label: test.tail,
        type: 'test' as 'test',
        file: test.path,
        line: test.line,
    }));
}

function splitTest(test: { head: string, tail: string, line: number, path: string }) {
    const separatorIndex = test.tail.indexOf('::');
    return {
        head: `${test.head}::${test.tail.substring(0, separatorIndex)}`,
        tail: test.tail.substring(separatorIndex + 2),
        name: test.tail.substring(0, separatorIndex),
        path: test.path,
        line: test.line,
    };
}

function splitModule(test: { id: string, line: number }, cwd: string) {
    const separatorIndex = test.id.indexOf('::');
    if (separatorIndex < 0) {
        return null;
    }
    return {
        modulePath: path.resolve(cwd, test.id.substring(0, separatorIndex)),
        testPath: test.id.substring(separatorIndex + 2),
        line: test.line,
    };
}
