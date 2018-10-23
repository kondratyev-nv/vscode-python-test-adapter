import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { TestEvent, TestSuiteInfo } from 'vscode-test-adapter-api';
import * as xml2js from 'xml2js';

import { parseTestSuites as parseCollectedTestSuites } from './pytestTestCollectionParser';


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
}

export function parseTestSuites(output: string, cwd: string): TestSuiteInfo[] {
    return parseCollectedTestSuites(output, cwd);
}

export async function parseTestStates(
    outputXmlFile: string,
    cwd: string
): Promise<TestEvent[]> {
    return new Promise<any>((resolve, reject) => {
        fs.readFile(outputXmlFile, 'utf8', (readError, data) => {
            if (readError) {
                return reject(readError);
            }

            xml2js.parseString(data, (parseError, parserResult) => {
                if (parseError) {
                    return reject(parseError);
                }

                const testSuiteResult: ITestSuiteResult = parserResult.testsuite;
                if (!Array.isArray(testSuiteResult.testcase)) {
                    return resolve([]);
                }
                const results = testSuiteResult.testcase.map((testcase: ITestCaseResult) => {
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
                }).filter(x => x);

                resolve(results);
            });
        });
    });
}

function getTestState(testcase: ITestCaseResult): ['passed' | 'failed' | 'skipped', string] {
    if (testcase.error) {
        return ['failed', extractErrorMessage(testcase.error)];
    }
    if (testcase.failure) {
        return ['failed', extractErrorMessage(testcase.failure)];
    }
    if (testcase.skipped) {
        return ['skipped', extractErrorMessage(testcase.skipped)];
    }
    return ['passed', ''];
}

function extractErrorMessage(errors: Array<{ $: { message: string; }; }>): string {
    if (!errors || !errors.length) {
        return '';
    }
    return errors.map(e => e.$.message).join(EOL);
}

function buildTestName(cwd: string, test: ITestCaseDescription): string | undefined {
    const pathParts = test.file.split(path.sep);
    const classParts = test.classname.split('.').filter(p => p !== '()');
    if (classParts.length < pathParts.length) {
        return undefined;
    }
    const module = path.resolve(cwd, test.file);
    if (classParts.length === pathParts.length) {
        return `${module}::${test.name}`;
    }
    const index = firstNotEqualIndex(pathParts, classParts);
    if (index === pathParts.length - 1) {
        return `${module}::${classParts.slice(index + 1).join('::')}::${test.name}`;
    }
    return undefined;
}

function firstNotEqualIndex<T>(a: T[], b: T[]): number {
    const length = Math.min(a.length, b.length);
    for (let index = 0; index < length; ++index) {
        if (a[index] !== b[index]) {
            return index;
        }
    }
    return a.length === b.length ? -1 : length;
}
