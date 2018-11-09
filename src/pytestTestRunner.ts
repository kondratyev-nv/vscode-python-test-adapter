import {
    TestEvent,
    TestInfo,
    TestSuiteInfo
} from 'vscode-test-adapter-api';

import * as tmp from 'tmp';

import { parseTestStates } from './pytestJunitTestStatesParser';
import { parseTestSuites } from './pytestTestCollectionParser';
import { runScript } from './pythonRunner';
import { ITestRunner } from './testRunner';
import { empty } from './utilities';
import { IWorkspaceConfiguration } from './workspaceConfiguration';

export class PytestTestRunner implements ITestRunner {
    private static readonly PYTEST_WRAPPER_SCRIPT = `
import pytest
import sys

pytest.main(sys.argv[1:])`;

    constructor(
        public readonly adapterId: string
    ) { }

    public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
        if (!config.getPytestConfiguration().isPytestEnabled) {
            return undefined;
        }

        const output = await runScript({
            pythonPath: config.pythonPath(),
            script: PytestTestRunner.PYTEST_WRAPPER_SCRIPT,
            args: ['--collect-only'],
            cwd: config.getCwd(),
        });
        const suites = parseTestSuites(output, config.getCwd());
        if (empty(suites)) {
            return undefined;
        }

        return {
            type: 'suite',
            id: this.adapterId,
            label: 'Pytest tests',
            children: suites,
        };
    }

    public async run(config: IWorkspaceConfiguration, info: TestSuiteInfo | TestInfo): Promise<TestEvent[]> {
        const tempFile = await this.createTemporaryFile();
        const xunitArgument = `--junitxml=${tempFile.file}`;
        await runScript({
            pythonPath: config.pythonPath(),
            script: PytestTestRunner.PYTEST_WRAPPER_SCRIPT,
            cwd: config.getCwd(),
            args: info.id !== this.adapterId ? [xunitArgument, info.id] : [xunitArgument],
        });
        const states = await parseTestStates(tempFile.file, config.getCwd());
        tempFile.cleanupCallback();
        return states;
    }

    private async createTemporaryFile(): Promise<{ file: string, cleanupCallback: () => void }> {
        return new Promise<{ file: string, cleanupCallback: () => void }>((resolve, reject) => {
            tmp.file((error, file, _, cleanupCallback) => {
                if (error) {
                    reject('Can not create temporary file: ' + error);
                }
                resolve({ file, cleanupCallback });
            });
        });
    }
}
