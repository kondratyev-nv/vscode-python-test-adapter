import * as path from 'path';
import * as tmp from 'tmp';
import {
    TestEvent,
    TestSuiteInfo
} from 'vscode-test-adapter-api';

import { IWorkspaceConfiguration } from '../configuration/workspaceConfiguration';
import { EnvironmentVariablesLoader } from '../environmentVariablesLoader';
import { ILogger } from '../logging/logger';
import { IProcessExecution, runScript } from '../pythonRunner';
import { IDebugConfiguration, ITestRunner } from '../testRunner';
import { empty, ensureDifferentLabels } from '../utilities';
import { parseTestStates } from './pytestJunitTestStatesParser';
import { parseTestSuites } from './pytestTestCollectionParser';

export class PytestTestRunner implements ITestRunner {
    private static readonly PYTEST_WRAPPER_SCRIPT = `
from __future__ import print_function

import pytest
import sys

class PythonTestExplorerDiscoveryOutputPlugin(object):
    def pytest_collection_finish(self, session):
        print('==DISCOVERED TESTS BEGIN==')
        for item in session.items:
            print(item.nodeid)
        print('==DISCOVERED TESTS   END==')

pytest.main(sys.argv[1:], plugins=[PythonTestExplorerDiscoveryOutputPlugin()])`;

    private readonly testExecutions: Map<string, IProcessExecution> = new Map<string, IProcessExecution>();

    constructor(
        public readonly adapterId: string,
        private readonly logger: ILogger
    ) { }

    public cancel(): void {
        this.testExecutions.forEach((execution, test) => {
            this.logger.log('info', `Cancelling execution of ${test}`);
            try {
                execution.cancel();
            } catch (error) {
                this.logger.log('crit', `Cancelling execution of ${test} failed: ${error}`);
            }
        });
    }

    public debugConfiguration(config: IWorkspaceConfiguration, test: string): IDebugConfiguration {
        return {
            module: 'pytest',
            cwd: config.getCwd(),
            args: test !== this.adapterId ? [test] : [],
            envFile: config.envFile(),
        };
    }

    public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
        if (!config.getPytestConfiguration().isPytestEnabled) {
            this.logger.log('info', 'Pytest test discovery is disabled');
            return undefined;
        }
        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), this.logger);
        this.logger.log('info', `Discovering tests using python path "${config.pythonPath()}" in ${config.getCwd()}`);
        const result = await runScript({
            pythonPath: config.pythonPath(),
            script: PytestTestRunner.PYTEST_WRAPPER_SCRIPT,
            args: ['--collect-only', '-qq'],
            cwd: config.getCwd(),
            environment: additionalEnvironment,
        }).complete();

        const suites = parseTestSuites(result.output, config.getCwd());
        if (empty(suites)) {
            this.logger.log('warn', 'No tests discovered');
            return undefined;
        }
        ensureDifferentLabels(suites, path.sep);

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
        const { file, cleanupCallback } = await this.createTemporaryFile();
        const xunitArgument = `--junitxml=${file}`;
        const testExecution = runScript({
            pythonPath: config.pythonPath(),
            script: PytestTestRunner.PYTEST_WRAPPER_SCRIPT,
            cwd: config.getCwd(),
            args: test !== this.adapterId ? [xunitArgument, test] : [xunitArgument],
            environment: additionalEnvironment,
        });
        this.testExecutions.set(test, testExecution);
        await testExecution.complete();
        this.testExecutions.delete(test);
        this.logger.log('info', 'Test execution completed');
        const states = await parseTestStates(file, config.getCwd());
        cleanupCallback();
        return states;
    }

    private async createTemporaryFile(): Promise<{ file: string, cleanupCallback: () => void }> {
        return new Promise<{ file: string, cleanupCallback: () => void }>((resolve, reject) => {
            tmp.file((error, file, _, cleanupCallback) => {
                if (error) {
                    reject(`Can not create temporary file ${file}: ${error}`);
                }
                resolve({ file, cleanupCallback });
            });
        });
    }
}
