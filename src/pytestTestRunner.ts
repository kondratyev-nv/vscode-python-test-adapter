import {
    TestEvent,
    TestSuiteInfo
} from 'vscode-test-adapter-api';

import * as tmp from 'tmp';

import { EnvironmentVariablesLoader } from './environmentVariablesLoader';
import { ILogger } from './logging/logger';
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
        public readonly adapterId: string,
        private readonly logger: ILogger
    ) { }

    public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
        if (!config.getPytestConfiguration().isPytestEnabled) {
            this.logger.log('info', 'Pytest test discovery is disabled');
            return undefined;
        }
        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), this.logger);
        this.logger.log('info', `Discovering tests using python path "${config.pythonPath()}" in ${config.getCwd()}`);
        const output = await runScript({
            pythonPath: config.pythonPath(),
            script: PytestTestRunner.PYTEST_WRAPPER_SCRIPT,
            args: ['--collect-only'],
            cwd: config.getCwd(),
            environment: additionalEnvironment,
        });
        const suites = parseTestSuites(output, config.getCwd());
        if (empty(suites)) {
            this.logger.log('warn', 'No tests discovered');
            return undefined;
        }

        return {
            type: 'suite',
            id: this.adapterId,
            label: 'Pytest tests',
            children: suites,
        };
    }

    public async run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]> {
        this.logger.log('info', `Running tests using python path "${config.pythonPath()}" in ${config.getCwd()}`);

        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), this.logger);
        const tempFile = await this.createTemporaryFile();
        const xunitArgument = `--junitxml=${tempFile.file}`;
        await runScript({
            pythonPath: config.pythonPath(),
            script: PytestTestRunner.PYTEST_WRAPPER_SCRIPT,
            cwd: config.getCwd(),
            args: test !== this.adapterId ? [xunitArgument, test] : [xunitArgument],
            environment: additionalEnvironment,
        });

        this.logger.log('info', 'Test execution completed');
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
