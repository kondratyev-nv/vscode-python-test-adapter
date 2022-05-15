
import { EOL } from 'os';
import * as path from 'path';
import { TestEvent } from 'vscode-test-adapter-api';
import * as xml2js from 'xml2js';

import { empty } from '../utilities/collections';
import { readFile, readDir } from '../utilities/fs';
import { concatNonEmpty } from '../utilities/strings';

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
    outputXmlDir: string
): Promise<TestEvent[]> {

    const xmlDirContent = await readDir(outputXmlDir);
    let testResults: TestEvent[] = [];

    for (const xmlFile of xmlDirContent) {
        const content = await readFile(path.join(outputXmlDir, xmlFile));
        const parseResult = await parseXml(content);
        testResults = testResults.concat(parseTestResults(parseResult));
    }

    return testResults;
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

function parseTestResults(parserResult: any): TestEvent[] {
    if (!parserResult) {
        return [];
    }
    const testSuiteResults: ITestSuiteResult[] = parserResult.testsuites.testsuite;
    return testSuiteResults.map(testSuiteResult => {
        if (!Array.isArray(testSuiteResult.testcase)) {
            return [];
        }
        return testSuiteResult.testcase.map(testcase => mapToTestState(testcase)).filter(x => x).map(x => x!);
    }).reduce((r, x) => r.concat(x), []);
}

function mapToTestState(testcase: ITestCaseResult): TestEvent | undefined {
    const testId = testcase.$.classname;
    if (!testId) {
        return undefined;
    }
    const [state, output, message, time] = getTestState(testcase);
    // const decorations = getDecorations(state, message);
    return {
        state,
        test: testId,
        type: 'test' as const,
        message: concatNonEmpty(EOL + EOL, message, output),
        // decorations,
        description: time ? `(${time}s)` : undefined,
    };
}

function getTestState(testcase: ITestCaseResult): [TestState, string, string, number | undefined] {
    const output = concatNonEmpty(EOL, extractSystemOut(testcase), extractSystemErr(testcase));
    const executionTime = testcase.$.time
    if (testcase.error) {
        return ['failed',    output, extractErrorMessage(testcase.error), executionTime];
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
    return empty(testcase['system-out']) ? '' : testcase['system-out'].join(EOL);
}

function extractSystemErr(testcase: ITestCaseResult) {
    return empty(testcase['system-err']) ? '' : testcase['system-err'].join(EOL);
}

function extractErrorMessage(errors: { _: string, $: { message: string } }[]): string {
    if (!errors || !errors.length) {
        return '';
    }
    return concatNonEmpty(EOL, ...errors.map(e => concatNonEmpty(EOL, e.$.message, e._)));
}