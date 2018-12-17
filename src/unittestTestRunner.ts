import * as path from 'path';
import {
    TestEvent,
    TestSuiteInfo
} from 'vscode-test-adapter-api';

import { EnvironmentVariablesLoader } from './environmentVariablesLoader';
import { ILogger } from './logging/logger';
import { runScript } from './pythonRunner';
import { ITestRunner } from './testRunner';
import { unittestHelperScript } from './unittestScripts';
import { parseTestStates, parseTestSuites } from './unittestSuitParser';
import { empty } from './utilities';
import { IWorkspaceConfiguration } from './workspaceConfiguration';

export class UnittestTestRunner implements ITestRunner {
    constructor(
        public readonly adapterId: string,
        private readonly logger: ILogger
    ) { }

    public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
        if (!config.getUnittestConfiguration().isUnittestEnabled) {
            this.logger.log('info', 'Unittest test discovery is disabled');
            return undefined;
        }

        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), this.logger);
        const unittestArguments = config.getUnittestConfiguration().unittestArguments;
        this.logger.log('info', `Discovering tests using python path "${config.pythonPath()}" in ${config.getCwd()} ` +
            `with pattern ${unittestArguments.pattern} and start directory ${unittestArguments.startDirectory}`);
        const output = await runScript({
            pythonPath: config.pythonPath(),
            script: unittestHelperScript(unittestArguments),
            args: ['discover'],
            cwd: config.getCwd(),
            environment: additionalEnvironment,
        });
        const suites = parseTestSuites(output, path.resolve(config.getCwd(), unittestArguments.startDirectory));
        if (empty(suites)) {
            this.logger.log('warn', 'No tests discovered');
            return undefined;
        }

        return {
            type: 'suite',
            id: this.adapterId,
            label: 'Unittest tests',
            children: suites,
        };
    }

    public async run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]> {
        const unittestArguments = config.getUnittestConfiguration().unittestArguments;
        this.logger.log('info', `Running tests using python path "${config.pythonPath()}" in ${config.getCwd()} ` +
            `with pattern ${unittestArguments.pattern} and start directory ${unittestArguments.startDirectory}`);
        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), this.logger);
        const output = await runScript({
            pythonPath: config.pythonPath(),
            script: unittestHelperScript(unittestArguments),
            cwd: config.getCwd(),
            args: test !== this.adapterId ? ['run', test] : ['run'],
            environment: additionalEnvironment,
        });
        return parseTestStates(output);
    }
}
