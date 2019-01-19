import * as path from 'path';
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
import { unittestHelperScript } from './unittestScripts';
import { parseTestStates, parseTestSuites } from './unittestSuitParser';

export class UnittestTestRunner implements ITestRunner {
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

    public debugConfiguration(): IDebugConfiguration {
        throw new Error('Unittest debugging is not supported at the time.');
    }

    public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
        if (!config.getUnittestConfiguration().isUnittestEnabled) {
            this.logger.log('info', 'Unittest test discovery is disabled');
            return undefined;
        }

        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), this.logger);
        const unittestArguments = config.getUnittestConfiguration().unittestArguments;
        this.logger.log('info', `Discovering tests using python path "${config.pythonPath()}" in ${config.getCwd()} ` +
            `with pattern ${unittestArguments.pattern} and start directory ${unittestArguments.startDirectory}`);

        const result = await runScript({
            pythonPath: config.pythonPath(),
            script: unittestHelperScript(unittestArguments),
            args: ['discover'],
            cwd: config.getCwd(),
            environment: additionalEnvironment,
        }).complete();

        const suites = parseTestSuites(result.output, path.resolve(config.getCwd(), unittestArguments.startDirectory));
        if (empty(suites)) {
            this.logger.log('warn', 'No tests discovered');
            return undefined;
        }
        ensureDifferentLabels(suites, '.');

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
        const testExecution = runScript({
            pythonPath: config.pythonPath(),
            script: unittestHelperScript(unittestArguments),
            cwd: config.getCwd(),
            args: test !== this.adapterId ? ['run', test] : ['run'],
            environment: additionalEnvironment,
        });
        this.testExecutions.set(test, testExecution);
        const result = await testExecution.complete();
        this.testExecutions.delete(test);
        return parseTestStates(result.output);
    }
}
