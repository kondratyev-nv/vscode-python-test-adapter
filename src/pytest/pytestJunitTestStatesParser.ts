
import { EOL } from 'os';
import * as path from 'path';
import { TestEvent } from 'vscode-test-adapter-api';
import * as xml2js from 'xml2js';

import { empty } from '../utilities/collections';
import { readFile } from '../utilities/fs';
import { startsWith } from '../utilities/strings';

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
    time: number;
}

interface ITestCaseResult {
    $: ITestCaseDescription;
    failure: {
        _: string;
        $: { message: string; type: string };
    }[];
    error: {
        _: string;
        $: { message: string; type: string };
    }[];
    skipped: {
        _: string;
        $: { message: string; type: string };
    }[];
    'system-out': string[];
    'system-err': string[];
}

type TestState = 'passed' | 'failed' | 'skipped';

export async function parseTestStates(
    outputXmlFile: string,
    cwd: string
): Promise<TestEvent[]> {
    const content = await readFile(outputXmlFile);
    const parseResult = await parseXml(content);
    return parseTestResults(parseResult, cwd);
}

function parseXml(content: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        xml2js.parseString(content, (parseError, parserResult) => {
            if (parseError) {
                return reject(parseError);
            }

            resolve(parserResult);
        });
    });
}

function parseTestResults(parserResult: any, cwd: string): TestEvent[] {
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
        return testSuiteResult.testcase.map(testcase => mapToTestState(testcase, cwd)).filter(x => x).map(x => x!);
    }).reduce((r, x) => r.concat(x), []);
}

function mapToTestState(testcase: ITestCaseResult, cwd: string): TestEvent | undefined {
    const testId = buildTestName(cwd, testcase.$);
    if (!testId) {
        return undefined;
    }
    const [state, output, message, time] = getTestState(testcase);
    const decorations = getDecorations(state, testcase.$.line, message);
    return {
        state,
        test: testId,
        type: 'test' as 'test',
        message: message + EOL + EOL + output,
        decorations,
        description: time ? `(${time}s)` : undefined,
    };
}

function getDecorations(state: TestState, line: string, message: string): { line: number, message: string }[] {
    if (state === 'passed') {
        return [];
    }
    if (!line) {
        return [];
    }
    const lineNumber = parseInt(line, 10);
    return [{
        line: lineNumber,
        message,
    }];
}

function getTestState(testcase: ITestCaseResult): [TestState, string, string, number | undefined] {
    const output = extractSystemOut(testcase) + extractSystemErr(testcase);
    const executionTime = testcase.$.time;
    if (testcase.error) {
        return ['failed', output, extractErrorMessage(testcase.error), executionTime];
    }
    if (testcase.failure) {
        return ['failed', output, extractErrorMessage(testcase.failure), executionTime];
    }
    if (testcase.skipped) {
        return ['skipped', output, extractErrorMessage(testcase.skipped), executionTime];
    }
    return ['passed', '', output, executionTime];
}

function extractSystemOut(testcase: ITestCaseResult) {
    return empty(testcase['system-out']) ? '' : testcase['system-out'].join(EOL) + EOL;
}

function extractSystemErr(testcase: ITestCaseResult) {
    return empty(testcase['system-err']) ? '' : testcase['system-err'].join(EOL) + EOL;
}

function extractErrorMessage(errors: { _: string, $: { message: string } }[]): string {
    if (!errors || !errors.length) {
        return '';
    }
    return errors.map(e => e.$.message + EOL + e._).join(EOL);
}

function buildTestName(cwd: string, test: ITestCaseDescription): string | undefined {
    if (!test || !test.file || !test.name) {
        return undefined;
    }
    const module = path.resolve(cwd, test.file);
    if (!test.classname) {
        return `${module}`;
    }
    const testClass = test.classname.split('.').filter(p => p).filter(p => p !== '()').join('.');
    const { matched, position } = matchModule(testClass, test.file);
    if (!matched) {
        return undefined;
    }

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
    if (startsWith(testClass, name, position)) {
        let moduleEndPosition = position + name.length;
        // There is a possibility that class name contains file extension, see Tavern test plugin, for example.
        if (ext && startsWith(testClass, ext, moduleEndPosition)) {
            moduleEndPosition += ext.length;
        }
        if (startsWith(testClass, '.', moduleEndPosition)) {
            moduleEndPosition += 1;
        }
        return { matched: true, position: moduleEndPosition };
    }
    return { matched: false, position: -1 };
}

function matchParentPath(testClass: string, testFile: string): { matched: boolean, position: number } {
    const parentPathToMatch = path.parse(testFile).dir;
    if (!parentPathToMatch) {
        return { matched: true, position: 0 };
    }
    const testFileParentPath = parentPathToMatch.split(path.sep);
    let index = 0;
    const allClassPartsMatchesPath = testFileParentPath.every(pathPart => {
        if (startsWith(testClass, pathPart + '.', index)) {
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
