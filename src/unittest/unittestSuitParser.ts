import { Base64 } from 'js-base64';
import * as os from 'os';
import * as path from 'path';
import { TestEvent, TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { distinctBy, groupBy } from '../utilities';
import { TEST_RESULT_PREFIX } from './unittestScripts';

const DISCOVERED_TESTS_START_MARK = '==DISCOVERED TESTS BEGIN==';
const DISCOVERED_TESTS_END_MARK = '==DISCOVERED TESTS END==';

interface IDiscoveryResultJson {
    tests: { id: string }[];
    errors: { class: string, message: number }[];
}

export function parseTestSuites(content: string, cwd: string): {
    suites: (TestSuiteInfo | TestInfo)[],
    errors: { id: string, message: string }[]
} {
    const from = content.indexOf(DISCOVERED_TESTS_START_MARK);
    const to = content.indexOf(DISCOVERED_TESTS_END_MARK);
    const discoveredTestsJson = content.substring(from + DISCOVERED_TESTS_START_MARK.length, to);
    const discoveryResult = JSON.parse(discoveredTestsJson) as IDiscoveryResultJson;
    if (!discoveryResult) {
        return { suites: [], errors: [] };
    }
    const allTests = (discoveryResult.tests || [])
        .map(line => line.id.trim())
        .filter(id => id)
        .map(id => splitTestId(id))
        .filter(id => id)
        .map(id => id!);

    const aggregatedErrors = Array.from(groupBy((discoveryResult.errors || []), e => e.class).entries())
        .map(([className, messages]) => ({
            id: splitTestId(className),
            message: messages.map(e => e.message).join(os.EOL),
        }))
        .filter(e => e.id)
        .map(e => ({ id: e.id!, message: e.message }));
    const discoveryErrorSuites = aggregatedErrors.map(({ id }) => <TestSuiteInfo | TestInfo>({
        type: 'test' as 'test',
        id: id.testId,
        label: id.testLabel,
    }));
    const suites = Array.from(groupBy(allTests, t => t.suiteId).entries())
        .map(([suiteId, tests]) => {
            const suiteFile = filePathBySuiteId(cwd, suiteId);
            return <TestSuiteInfo | TestInfo>{
                type: 'suite' as 'suite',
                id: suiteId,
                label: suiteId.substring(suiteId.lastIndexOf('.') + 1),
                file: suiteFile,
                tooltip: suiteId,
                children: tests.map(test => ({
                    type: 'test' as 'test',
                    id: test.testId,
                    label: test.testLabel,
                    file: suiteFile,
                    tooltip: test.testId,
                })),
            };
        });

    return {
        suites: suites.concat(discoveryErrorSuites),
        errors: aggregatedErrors.map(e => ({ id: e.id.testId, message: e.message })),
    };
}

export function parseTestStates(output: string): TestEvent[] {
    const testEvents = output
        .split(/\r?\n/g)
        .map(line => line.trim())
        .map(line => tryParseTestState(line))
        .filter(line => line)
        .map(line => line!);

    // HACK: Remove duplicates by id so it does not appear in the debug console more than once,
    // because right now script is printing test results multiple times.
    return distinctBy(testEvents, e => e.test);
}

function tryParseTestState(line: string): TestEvent | undefined {
    if (!line) {
        return undefined;
    }
    if (!line.startsWith(TEST_RESULT_PREFIX)) {
        return undefined;
    }
    const [, result, testId, base64Message = ''] = line.split(':');
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

function splitTestId(testId: string) {
    const separatorIndex = testId.lastIndexOf('.');
    if (separatorIndex < 0) {
        return null;
    }
    return {
        suiteId: testId.substring(0, separatorIndex),
        testId,
        testLabel: testId.substring(separatorIndex + 1),
    };
}

function filePathBySuiteId(cwd: string, suiteId: string) {
    const separatorIndex = suiteId.lastIndexOf('.');
    if (separatorIndex < 0) {
        return undefined;
    }
    return path.resolve(cwd, suiteId.substring(0, separatorIndex).split('.').join('/') + '.py');
}
