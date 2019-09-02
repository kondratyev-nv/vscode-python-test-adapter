import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { TestEvent } from 'vscode-test-adapter-api';
import * as xml2js from 'xml2js';

import { empty } from '../utilities';

interface ITestSuiteResult {
    $: {
        errors: string;
        failures: string;
        name: string;
        skips: string;
        skip: string;
        tests: string;
        time: string;
    };
    testcase: ITestCaseResult[];
}

interface ITestCaseDescription {
    classname: string;
    file: string;
    line: string;
    name: string;
}

interface ITestCaseResult {
    $: ITestCaseDescription;
    failure: Array<{
        _: string;
        $: { message: string; type: string };
    }>;
    error: Array<{
        _: string;
        $: { message: string; type: string };
    }>;
    skipped: Array<{
        _: string;
        $: { message: string; type: string };
    }>;
    'system-out': string[];
}

export async function parseTestStates(
    outputXmlFile: string,
    cwd: string
): Promise<TestEvent[]> {
    return new Promise<any>((resolve, reject) => {
        fs.readFile(outputXmlFile, 'utf8', (readError, data) => {
            if (readError) {
                return reject(`Can not read test results: ${readError}`);
            }

            xml2js.parseString(data, (parseError, parserResult) => {
                if (parseError) {
                    return reject(parseError);
                }

                try {
                    const results = parseTestResults(parserResult, cwd);
                    resolve(results);
                } catch (exception) {
                    reject(`Can not parse test results: ${exception}`);
                }
            });
        });
    });
}

function parseTestResults(parserResult: any, cwd: string) {
    if (!parserResult) {
        return [];
    }
    const testSuiteResults: ITestSuiteResult[] = parserResult.testsuites ?
        parserResult.testsuites.testsuite : // from pytest 5.1.0, see https://github.com/pytest-dev/pytest/issues/5477
        [parserResult.testsuite];           // before pytest 5.1.0
    return testSuiteResults.map(testSuiteResult => {
        if (!Array.isArray(testSuiteResult.testcase)) {
            return [];
        }
        return testSuiteResult.testcase.map(testcase => mapToTestState(testcase, cwd)).filter(x => x);
    }).reduce((r, x) => r.concat(x), []);
}

function mapToTestState(testcase: ITestCaseResult, cwd: string) {
    const testId = buildTestName(cwd, testcase.$);
    if (!testId) {
        return undefined;
    }
    const [state, message] = getTestState(testcase);
    const decorations = state !== 'passed' ? [{
        line: testcase.$.line,
        message,
    }] : null;
    return {
        state,
        test: testId,
        type: 'test',
        message,
        decorations,
    };
}

function getTestState(testcase: ITestCaseResult): ['passed' | 'failed' | 'skipped', string] {
    const output = empty(testcase['system-out']) ? '' : testcase['system-out'].join(EOL) + EOL;
    if (testcase.error) {
        return ['failed', output + extractErrorMessage(testcase.error)];
    }
    if (testcase.failure) {
        return ['failed', output + extractErrorMessage(testcase.failure)];
    }
    if (testcase.skipped) {
        return ['skipped', output + extractErrorMessage(testcase.skipped)];
    }
    return ['passed', output];
}

function extractErrorMessage(errors: Array<{ _: string, $: { message: string } }>): string {
    if (!errors || !errors.length) {
        return '';
    }
    return errors.map(e => e.$.message + EOL + e._).join(EOL);
}

function buildTestName(cwd: string, test: ITestCaseDescription): string | undefined {
    if (!test || !test.file || !test.classname || !test.name) {
        return undefined;
    }
    const testClass = test.classname.split('.').filter(p => p).filter(p => p !== '()').join('.');
    const { matched, position } = matchModule(testClass, test.file);
    if (!matched) {
        return undefined;
    }

    const module = path.resolve(cwd, test.file);
    const testClassParts = testClass.substring(position).split('.').filter(p => p);
    if (testClassParts.length > 0) {
        return `${module}::${testClassParts.join('::')}::${test.name}`;
    } else {
        return `${module}::${test.name}`;
    }
}

function matchModule(testClass: string, testFile: string): { matched: boolean, position: number } {
    const { matched, position } = matchParentPath(testClass, testFile);
    if (!matched) {
        return { matched: false, position: -1 };
    }
    const { name, ext } = path.parse(testFile);
    if (testClass.startsWith(name, position)) {
        let moduleEndPosition = position + name.length;
        // There is a possibility that class name contains file extension, see Tavern test plugin, for example.
        if (ext && testClass.startsWith(ext, moduleEndPosition)) {
            moduleEndPosition += ext.length;
        }
        if (testClass.startsWith('.', moduleEndPosition)) {
            moduleEndPosition += 1;
        }
        return { matched: true, position: moduleEndPosition };
    }
    return { matched: false, position: -1 };
}

function matchParentPath(testClass: string, testFile: string): { matched: boolean, position: number } {
    const testFileParentPath = path.parse(testFile).dir.split(path.sep);
    let index = 0;
    const allClassPartsMatchesPath = testFileParentPath.every(pathPart => {
        if (testClass.startsWith(pathPart + '.', index)) {
            index += pathPart.length + 1;
            return true;
        }
        return false;
    });
    return {
        matched: allClassPartsMatchesPath,
        position: index,
    };
}
