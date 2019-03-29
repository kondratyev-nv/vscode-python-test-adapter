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
            tooltip: modulePath,
            children: toTestSuites(
                tests.map(t => ({
                    idHead: t.modulePath,
                    idTail: t.testPath,
                    line: t.line,
                    path: modulePath,
                }))
            ),
        }));
}

interface ITestCaseSplit {
    idHead: string;
    idTail: string;
    line: number;
    path: string;
}

function toTestSuites(tests: ITestCaseSplit[]): Array<TestSuiteInfo | TestInfo> {
    if (empty(tests)) {
        return [];
    }
    const testsAndSuites = groupBy(tests, t => t.idTail.includes('::'));
    const firstLevelTests: Array<TestSuiteInfo | TestInfo> = toFirstLevelTests(testsAndSuites.get(false));
    const suites: Array<TestSuiteInfo | TestInfo> = toSuites(testsAndSuites.get(true));
    return firstLevelTests.concat(suites);
}

function toSuites(suites: ITestCaseSplit[] | undefined): TestSuiteInfo[] {
    if (!suites) {
        return [];
    }
    return Array.from(groupBy(suites.map(test => splitTest(test)), group => group.idHead).entries())
        .map(([suite, suiteTests]) => ({
            type: 'suite' as 'suite',
            id: suite,
            label: suiteTests[0].name,
            file: suiteTests[0].path,
            children: toTestSuites(suiteTests),
            tooltip: suite,
        }));
}

function toFirstLevelTests(tests: ITestCaseSplit[] | undefined): TestInfo[] {
    if (!tests) {
        return [];
    }
    return tests.map(test => {
        const testId = `${test.idHead}::${test.idTail}`;
        return {
            id: testId,
            label: test.idTail,
            type: 'test' as 'test',
            file: test.path,
            line: test.line,
            tooltip: testId,
        };
    });
}

function splitTest(test: ITestCaseSplit) {
    const separatorIndex = test.idTail.indexOf('::');
    return {
        idHead: `${test.idHead}::${test.idTail.substring(0, separatorIndex)}`,
        idTail: test.idTail.substring(separatorIndex + 2),
        name: test.idTail.substring(0, separatorIndex),
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
        // Use full path for matching with test results from junit-xml
        modulePath: path.resolve(cwd, test.id.substring(0, separatorIndex)),
        testPath: test.id.substring(separatorIndex + 2),
        line: test.line,
    };
}
