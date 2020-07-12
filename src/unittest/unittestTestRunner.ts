import * as path from 'path';
import {
    TestEvent, TestSuiteInfo
} from 'vscode-test-adapter-api';

import { IWorkspaceConfiguration } from '../configuration/workspaceConfiguration';
import { EnvironmentVariablesLoader } from '../environmentVariablesLoader';
import { ILogger } from '../logging/logger';
import { IProcessExecution, runScript } from '../pythonRunner';
import { IDebugConfiguration, ITestRunner } from '../testRunner';
import { empty } from '../utilities/collections';
import { setDescriptionForEqualLabels } from '../utilities/tests';
import { UNITTEST_TEST_RUNNER_SCRIPT } from './unittestScripts';
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

    public async debugConfiguration(config: IWorkspaceConfiguration, test: string): Promise<IDebugConfiguration> {
        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), process.env, this.logger);
        const unittestArguments = config.getUnittestConfiguration().unittestArguments;
        const testId = this.normalizeDebugTestId(unittestArguments.startDirectory, config.getCwd(), test);
        this.logger.log('info', `Debugging test "${testId}" using python path "${config.pythonPath()}" in ${config.getCwd()}`);
        return {
            module: 'unittest',
            cwd: config.getCwd(),
            args: [testId],
            env: additionalEnvironment,
        }
    }

    public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
        if (!config.getUnittestConfiguration().isUnittestEnabled) {
            this.logger.log('info', 'Unittest test discovery is disabled');
            return undefined;
        }

        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), process.env, this.logger);
        const unittestArguments = config.getUnittestConfiguration().unittestArguments;
        this.logger.log('info', `Discovering tests using python path "${config.pythonPath()}" in ${config.getCwd()} ` +
            `with pattern ${unittestArguments.pattern} and start directory ${unittestArguments.startDirectory}`);

        const result = await runScript({
            pythonPath: config.pythonPath(),
            script: UNITTEST_TEST_RUNNER_SCRIPT,
            args: ['discover', unittestArguments.startDirectory, unittestArguments.pattern],
            cwd: config.getCwd(),
            environment: additionalEnvironment,
        }).complete();

        const tests = parseTestSuites(
            result.output,
            path.resolve(config.getCwd(), unittestArguments.startDirectory)
        );
        if (empty(tests)) {
            this.logger.log('warn', 'No tests discovered');
            return undefined;
        }
        setDescriptionForEqualLabels(tests, '.');

        return {
            type: 'suite',
            id: this.adapterId,
            label: 'Unittest tests',
            children: tests,
        };
    }

    public async run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]> {
        const unittestArguments = config.getUnittestConfiguration().unittestArguments;
        this.logger.log('info', `Running tests using python path "${config.pythonPath()}" in ${config.getCwd()} ` +
            `with pattern ${unittestArguments.pattern} and start directory ${unittestArguments.startDirectory}`);
        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), process.env, this.logger);
        const testExecution = runScript({
            pythonPath: config.pythonPath(),
            script: UNITTEST_TEST_RUNNER_SCRIPT,
            cwd: config.getCwd(),
            args: test !== this.adapterId ?
                ['run', unittestArguments.startDirectory, unittestArguments.pattern, test] :
                ['run', unittestArguments.startDirectory, unittestArguments.pattern],
            environment: additionalEnvironment,
        });
        this.testExecutions.set(test, testExecution);
        const result = await testExecution.complete();
        this.testExecutions.delete(test);
        return parseTestStates(result.output);
    }

    private normalizeDebugTestId(startDirectory: string, cwd: string, relativeTestId: string): string {
        const relativeStartDirectory = path.isAbsolute(startDirectory) ?
            path.relative(cwd, startDirectory) :
            startDirectory;
        if (relativeStartDirectory === '.') {
            return relativeTestId;
        }
        const testPath = relativeStartDirectory.split(path.sep).join('.').replace(/\.+/, '.');
        if (testPath.endsWith('.')) {
            return testPath + relativeTestId;
        } else if (!testPath) {
            return relativeTestId;
        } else {
            return testPath + '.' + relativeTestId;
        }
    }
}
