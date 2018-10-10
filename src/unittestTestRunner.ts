import * as path from 'path';
import {
    TestEvent,
    TestInfo,
    TestSuiteInfo
} from 'vscode-test-adapter-api';

import { runScript } from './pythonRunner';
import { ITestRunner } from './testRunner';
import { unittestHelperScript } from './unittestScripts';
import { parseTestStates, parseTestSuites } from './unittestSuitParser';
import { IWorkspaceConfiguration } from './workspaceConfiguration';

export class UnittestTestRunner implements ITestRunner {
    constructor(
        public readonly adapterId: string
    ) { }

    public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
        if (!config.getUnittestConfiguration().isUnittestEnabled) {
            return undefined;
        }
        const unittestArguments = config.getUnittestConfiguration().unittestArguments;
        const output = await runScript({
            pythonPath: config.pythonPath(),
            script: unittestHelperScript(unittestArguments),
            args: ['discover'],
            cwd: config.getCwd(),
        });
        const suites = parseTestSuites(output, path.resolve(config.getCwd(), unittestArguments.startDirectory));
        return {
            type: 'suite',
            id: this.adapterId,
            label: 'All tests',
            children: suites,
        };
    }

    public async run(config: IWorkspaceConfiguration, info: TestSuiteInfo | TestInfo): Promise<TestEvent[]> {
        const output = await runScript({
            pythonPath: config.pythonPath(),
            script: unittestHelperScript(config.getUnittestConfiguration().unittestArguments),
            cwd: config.getCwd(),
            args: info.id !== this.adapterId ? ['run', info.id] : ['run'],
        });
        return parseTestStates(output);
    }
}
