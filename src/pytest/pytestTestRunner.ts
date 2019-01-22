import * as path from 'path';
import * as tmp from 'tmp';
import {
    TestEvent,
    TestSuiteInfo
} from 'vscode-test-adapter-api';

import { IWorkspaceConfiguration } from '../configuration/workspaceConfiguration';
import { EnvironmentVariablesLoader } from '../environmentVariablesLoader';
import { ILogger } from '../logging/logger';
import { runScript } from '../pythonRunner';
import { IDebugConfiguration, ITestRunner } from '../testRunner';
import { empty, ensureDifferentLabels } from '../utilities';
import { parseTestStates } from './pytestJunitTestStatesParser';
import { parseTestSuites } from './pytestTestCollectionParser';

export class PytestTestRunner implements ITestRunner {
    private static readonly PYTEST_WRAPPER_SCRIPT = `
from __future__ import print_function

import pytest
import sys
import json
import py

from _pytest.compat import getfslineno


def get_line_number(item):
    location = getattr(item, "location", None)
    if location is not None:
        return location[1]
    obj = getattr(item, "obj", None)
    if obj is not None:
        return getfslineno(obj)[1]
    return None


class PythonTestExplorerDiscoveryOutputPlugin(object):
    def pytest_collection_finish(self, session):
        print('==DISCOVERED TESTS BEGIN==')
        tests = []
        for item in session.items:
            line = get_line_number(item)
            tests.append({'id': item.nodeid,
                          'line': line})
        print(json.dumps(tests))
        print('==DISCOVERED TESTS END==')

pytest.main(sys.argv[1:], plugins=[PythonTestExplorerDiscoveryOutputPlugin()])`;

    constructor(
        public readonly adapterId: string,
        private readonly logger: ILogger
    ) { }

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
        const output = await runScript({
            pythonPath: config.pythonPath(),
            script: PytestTestRunner.PYTEST_WRAPPER_SCRIPT,
            args: ['--collect-only', '-qq'],
            cwd: config.getCwd(),
            environment: additionalEnvironment,
        });

        const suites = parseTestSuites(output, config.getCwd());
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
