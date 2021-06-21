import * as path from 'path';
import * as tmp from 'tmp';
import {
    TestEvent, TestSuiteInfo
} from 'vscode-test-adapter-api';

import { ArgumentParser } from 'argparse';
import { IWorkspaceConfiguration } from '../configuration/workspaceConfiguration';
import { IEnvironmentVariables, EnvironmentVariablesLoader } from '../environmentVariablesLoader';
import { ILogger } from '../logging/logger';
import { IProcessExecution, runProcess } from '../processRunner'
import { IDebugConfiguration, ITestRunner } from '../testRunner';
import { empty } from '../utilities/collections';
import { setDescriptionForEqualLabels } from '../utilities/tests';
import { parseTestStates } from './testplanJunitTestStatesParser';
import { parseTestSuites } from './testplanTestCollectionParser';

// --- Testplan Exit Codes ---
// 0: All tests were collected and passed successfully
// 1: Tests were collected and run but some of the tests failed or none found
const TESTPLAN_NON_ERROR_EXIT_CODES = [0, 1];

const DISCOVERY_OUTPUT_PLUGIN_INFO = {
    PACKAGE_PATH: path.resolve(__dirname, '../../resources/python'),
    MODULE_NAME: 'vscode_python_test_adapter.testplan.discovery_output_plugin',
};

interface IRunArguments {
    junitReportPath?: string;
    argumentsToPass: string[];
}

export class TestplanTestRunner implements ITestRunner {

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
        const additionalEnvironment = await this.loadEnvironmentVariables(config);
        const runArguments = this.getRunArguments(test, config.getTestplanConfiguration().testplanArguments);
        return {
            module: 'testplantest',
            cwd: config.getCwd(),
            args: runArguments.argumentsToPass,
            env: additionalEnvironment,
        };
    }

    public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
        if (!config.getTestplanConfiguration().isTestplanEnabled) {
            this.logger.log('info', 'TestPlan test discovery is disabled');
            return undefined;
        }
        const additionalEnvironment = await this.loadEnvironmentVariables(config);
        this.logger.log('info', `Discovering tests using python path '${config.pythonPath()}' in ${config.getCwd()}`);

        const discoveryArguments = this.getDiscoveryArguments(config.getTestplanConfiguration().testplanArguments);
        this.logger.log('info', `Running testplan with arguments: ${discoveryArguments.join(', ')}`);

        const result = await this.runTestPlan(config, additionalEnvironment, discoveryArguments).complete();
        const tests = parseTestSuites(result.output);
        if (empty(tests)) {
            this.logger.log('warn', 'No tests discovered');
            return undefined;
        }

        setDescriptionForEqualLabels(tests, path.sep);
        return {
            type: 'suite',
            id: this.adapterId,
            label: 'Testplan tests',
            children: tests,
        };
    }

    public async run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]> {
        if (!config.getTestplanConfiguration().isTestplanEnabled) {
            this.logger.log('info', 'Testplan test execution is disabled');
            return [];
        }
        this.logger.log('info', `Running tests using python path '${config.pythonPath()}' in ${config.getCwd()}`);

        const additionalEnvironment = await this.loadEnvironmentVariables(config);
        const runArguments = this.getRunArguments(test, config.getTestplanConfiguration().testplanArguments);
        const { dirName, cleanupCallback } = await this.getJunitReportPath(config.getCwd(), runArguments);
        const testRunArguments = [
            `--xml=${dirName}`
        ].concat(runArguments.argumentsToPass);
        this.logger.log('info', `Running testplan with arguments: ${testRunArguments.join(', ')}`);

        const testExecution = this.runTestPlan(config, additionalEnvironment, testRunArguments);

        this.testExecutions.set(test, testExecution);
        await testExecution.complete();
        this.testExecutions.delete(test);

        this.logger.log('info', 'Test execution completed');
        const states = await parseTestStates(dirName);

        cleanupCallback();
        return states;
    }

    private runTestPlan(config: IWorkspaceConfiguration, env: IEnvironmentVariables, args: string[])
    : IProcessExecution
    {
        const testplanPath = config.getTestplanConfiguration().testplanPath();

        this.logger.log('info', `Running ${testplanPath} as an executable`);
        return runProcess(
            config.pythonPath(),
            [testplanPath].concat(args),
            {
                cwd: config.getCwd(),
                environment: env,
                acceptedExitCodes: TESTPLAN_NON_ERROR_EXIT_CODES,
            });
    }

    private async loadEnvironmentVariables(config: IWorkspaceConfiguration): Promise<IEnvironmentVariables> {
        const envFileEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), process.env, this.logger);

        const updatedPythonPath = [
            config.getCwd(),
            envFileEnvironment.PYTHONPATH,
            process.env.PYTHONPATH,
            DISCOVERY_OUTPUT_PLUGIN_INFO.PACKAGE_PATH
        ].filter(item => item).join(path.delimiter);

        const updatedTestplanPlugins = [
            envFileEnvironment.TESTPLAN_PLUGINS,
            DISCOVERY_OUTPUT_PLUGIN_INFO.MODULE_NAME
        ].filter(item => item).join(',');

        return {
            ...envFileEnvironment,
            PYTHONPATH: updatedPythonPath,
            TESTPLAN_PLUGINS: updatedTestplanPlugins,
        };
    }

    private async getJunitReportPath(
        cwd: string,
        runArguments: IRunArguments
    ): Promise<{ dirName: string, cleanupCallback: () => void }> {
        if (runArguments.junitReportPath) {
            return Promise.resolve({
                dirName: path.resolve(cwd, runArguments.junitReportPath),
                cleanupCallback: () => { /* intentionally empty */ },
            });
        }
        return await this.createTemporaryDirectory();
    }

    private getDiscoveryArguments(rawTestplanArguments: string[]): string[] {
        const argumentParser = this.configureCommonArgumentParser();
        const [, argumentsToPass] = argumentParser.parse_known_args(rawTestplanArguments);
        return ['--info', 'pattern-full'].concat(argumentsToPass);
    }

    private getRunArguments(test: string, rawTestplanArguments: string[]): IRunArguments {
        const argumentParser = this.configureCommonArgumentParser();

        const [knownArguments, argumentsToPass] = argumentParser.parse_known_args(rawTestplanArguments);
        return {
            junitReportPath: (knownArguments as { xmlpath?: string }).xmlpath,
            argumentsToPass: argumentsToPass.concat(
                test !== this.adapterId ?
                    ['--pattern', test] :
                    (knownArguments as { tests?: string[] }).tests || []
            ),
        };
    }

    private configureCommonArgumentParser() {
        const argumentParser = new ArgumentParser({
            exit_on_error: false,
        });
        argumentParser.add_argument(
            '--runpath',
            { action: 'store', dest: 'runpath'});
        argumentParser.add_argument(
            '--timeout',
            { action: 'store', dest: 'timeout'});
        argumentParser.add_argument(
            '-v', '--verbose',
            { action: 'store', dest: 'verbose' });
        argumentParser.add_argument(
            '--stdout-style',
            { action: 'store', dest: 'stdout_style'});
        argumentParser.add_argument(
            '--shuffle',
            { action: 'store', dest: 'shuffle'});
        argumentParser.add_argument(
            '--shuffle-seed',
            { action: 'store', dest: 'shuffle_seed'});
        return argumentParser;
    }

    private async createTemporaryDirectory(): Promise<{ dirName: string, cleanupCallback: () => void }> {
        return new Promise<{ dirName: string, cleanupCallback: () => void }>((resolve, reject) => {
            tmp.dir((error, dirName, cleanupCallback) => {
                if (error) {
                    reject(new Error(`Can not create temporary directory ${dirName}: ${error}`));
                }
                resolve({ dirName, cleanupCallback });
            });
        });
    }
}
