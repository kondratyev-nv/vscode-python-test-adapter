import * as os from 'os';
import * as path from 'path';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

import { empty, groupBy } from '../utilities/collections';

const DISCOVERED_TESTS_START_MARK = '==DISCOVERED TESTS BEGIN==';
const DISCOVERED_TESTS_END_MARK = '==DISCOVERED TESTS END==';

interface IDiscoveryResultJson {
    tests: { id: string, line: number }[];
    errors: { file: string, message: number }[];
}

export function parseTestSuites(content: string, cwd: string): (TestSuiteInfo | TestInfo)[] {
    const from = content.indexOf(DISCOVERED_TESTS_START_MARK);
    const to = content.indexOf(DISCOVERED_TESTS_END_MARK);
    if (from < 0 || to < 0) {
        throw new Error(`Invalid test discovery output!${os.EOL}${content}`);
    }
    const discoveredTestsJson = content.substring(from + DISCOVERED_TESTS_START_MARK.length, to);
    const discoveryResult = JSON.parse(discoveredTestsJson) as IDiscoveryResultJson;
    const allTests = (discoveryResult.tests || [])
        .map(line => ({ ...line, id: line.id.replace(/::\(\)/g, '') }))
        .filter(line => line.id)
        .map(line => splitModule(line, cwd))
        .filter(line => line)
        .map(line => line!);
    const suites = Array.from(groupBy(allTests, t => t.modulePath).entries())
        .map(([modulePath, tests]) => <TestSuiteInfo | TestInfo>({
            type: 'suite' as const,
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
    const aggregatedErrors = Array.from(groupBy((discoveryResult.errors || []), e => e.file).entries())
        .map(([file, messages]) => ({
            file: path.resolve(cwd, file),
            message: messages.map(e => e.message).join(os.EOL),
        }));
    const discoveryErrorSuites = aggregatedErrors.map(({ file, message }) => <TestSuiteInfo | TestInfo>({
        type: 'test' as const,
        id: file,
        file,
        label: `Error in ${path.basename(file)}`,
        errored: true,
        message,
    }));
    return suites.concat(discoveryErrorSuites);
}

interface ITestCaseSplit {
    idHead: string;
    idTail: string;
    line: number;
    path: string;
}

function toTestSuites(tests: ITestCaseSplit[]): (TestSuiteInfo | TestInfo)[] {
    if (empty(tests)) {
        return [];
    }
    const testsAndSuites = groupBy(tests, t => t.idTail.includes('::'));
    const firstLevelTests: (TestSuiteInfo | TestInfo)[] = toFirstLevelTests(testsAndSuites.get(false));
    const suites: (TestSuiteInfo | TestInfo)[] = toSuites(testsAndSuites.get(true));
    return firstLevelTests.concat(suites);
}

function toSuites(suites: ITestCaseSplit[] | undefined): TestSuiteInfo[] {
    if (!suites) {
        return [];
    }
    return Array.from(groupBy(suites.map(test => splitTest(test)), group => group.idHead).entries())
        .map(([suite, suiteTests]) => ({
            type: 'suite' as const,
            id: suite,
            label: suiteTests[0].name,
            file: suiteTests[0].path,
            children: toTestSuites(suiteTests),
            tooltip: suite,
        }));
}

function toFirstLevelTests(tests: ITestCaseSplit[] | undefined): (TestSuiteInfo | TestInfo)[] {
    if (!tests) {
        return [];
    }
    const testsByParameterized = groupBy(tests, t => t.idTail.includes('['));
    const basicTests: (TestSuiteInfo | TestInfo)[] = (testsByParameterized.get(false) || []).map(toTest);
    const parameterizedTestsBySuite = groupBy(
        testsByParameterized.get(true) || [],
        t => t.idTail.substring(0, t.idTail.indexOf('[')));
    const parameterizedSuites: (TestSuiteInfo | TestInfo)[] = Array.from(parameterizedTestsBySuite.entries())
        .map(([baseName, parameterizedTests]) => ({
            type: 'suite' as const,
            id: `${parameterizedTests[0].idHead}::${baseName}`,
            label: baseName,
            file: parameterizedTests[0].path,
            children: parameterizedTests.map(toTest),
        }));
    return basicTests.concat(parameterizedSuites);
}

function toTest(test: ITestCaseSplit): TestInfo {
    const testId = `${test.idHead}::${test.idTail}`;
    return {
        id: testId,
        label: test.idTail,
        type: 'test' as const,
        file: test.path,
        line: test.line,
        tooltip: testId,
    };
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
