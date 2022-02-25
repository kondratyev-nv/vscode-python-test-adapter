import * as path from 'path';

import {
    TestEvent, TestSuiteInfo
} from 'vscode-test-adapter-api';

import { ArgumentParser } from 'argparse';
import { IWorkspaceConfiguration } from '../configuration/workspaceConfiguration';
import { IEnvironmentVariables, EnvironmentVariablesLoader } from '../environmentVariablesLoader';
import { ILogger } from '../logging/logger';
import { IProcessExecution, runProcess } from '../processRunner';
import { IDebugConfiguration, ITestRunner } from '../testRunner';
import { empty } from '../utilities/collections';
import { setDescriptionForEqualLabels } from '../utilities/tests';
import { parseTestStates } from './behaveTestJsonParser';
import { parseTestSuites } from './behaveTestJsonParser';
import { runModule } from '../pythonRunner';

// --- Behave Exit Codes ---
// 0: All tests were collected and passed successfully
// 1: Some tests have failed
const BEHAVE_NON_ERROR_EXIT_CODES = [0, 1];

const DISCOVERY_OUTPUT_PLUGIN_INFO = {
    PACKAGE_PATH: path.resolve(__dirname, '../../resources/python'),
    MODULE_NAME: 'vscode_python_test_adapter.behave.discovery_output_plugin',
};

interface IBehaveArguments {
    argumentsToPass: string[];
    locations: string[];
}


export class BehaveTestRunner implements ITestRunner {

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
        const runArguments = this.getRunArguments(test, config.getBehaveConfiguration().behaveArguments);
        const params = [ ...runArguments.argumentsToPass, ...runArguments.locations];
        return {
            module: 'behave',
            cwd: config.getCwd(),
            args: params,
            env: additionalEnvironment,
        };
    }

    public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
        if (!config.getBehaveConfiguration().isBehaveEnabled) {
            this.logger.log('info', 'Behave test discovery is disabled');
            return undefined;
        }
        const additionalEnvironment = await this.loadEnvironmentVariables(config);
        this.logger.log('info', `Discovering tests using python path '${config.pythonPath()}' in ${config.getCwd()}`);

        const discoveryArguments = this.getDiscoveryArguments(config.getBehaveConfiguration().behaveArguments);
        this.logger.log('info', `Running behave with arguments: ${discoveryArguments.argumentsToPass.join(', ')}`);
        this.logger.log('info', `Running behave with locations: ${discoveryArguments.locations.join(', ')}`);

        const params = [ ...discoveryArguments.argumentsToPass, ...discoveryArguments.locations];

        const result = await this.runBehave(config, additionalEnvironment, params).complete();
        const tests = parseTestSuites(result.output, config.getCwd());
        if (empty(tests)) {
            this.logger.log('warn', 'No tests discovered');
            return undefined;
        }

        setDescriptionForEqualLabels(tests, path.sep);
        return {
            type: 'suite',
            id: this.adapterId,
            label: 'Behave tests',
            children: tests,
        };
    }

    public async run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]> {
        if (!config.getBehaveConfiguration().isBehaveEnabled) {
            this.logger.log('info', 'Behave test execution is disabled');
            return [];
        }
        const additionalEnvironment = await this.loadEnvironmentVariables(config);
        this.logger.log('info', `Running tests using python path '${config.pythonPath()}' in ${config.getCwd()}`);

        const testRunArguments = this.getRunArguments(test, config.getBehaveConfiguration().behaveArguments);
        this.logger.log('info', `Running behave with arguments: ${testRunArguments.join(', ')}`);

        const result = await this.runBehave(config, additionalEnvironment, testRunArguments).complete();
        const states = parseTestStates(result.output);
        if (empty(states)) {
            // maybe an error occured
            this.logger.log('warn', 'No tests run');
            this.logger.log('warn', 'Output: ${result.output}');
        }

        return states;
    }

    private runBehave(config: IWorkspaceConfiguration, env: IEnvironmentVariables, args: string[]): IProcessExecution {
        const behavePath = config.getBehaveConfiguration().behavePath();
        if (behavePath === path.basename(behavePath)) {
            this.logger.log('info', `Running ${behavePath} as a Python module`);
            return runModule({
                pythonPath: config.pythonPath(),
                module: config.getBehaveConfiguration().behavePath(),
                environment: env,
                args,
                cwd: config.getCwd(),
                acceptedExitCodes: BEHAVE_NON_ERROR_EXIT_CODES,
            });
        }

        this.logger.log('info', `Running ${behavePath} as an executable`);
        return runProcess(
            behavePath,
            args,
            {
                cwd: config.getCwd(),
                environment: env,
                acceptedExitCodes: BEHAVE_NON_ERROR_EXIT_CODES,
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

        const updatedBehavePlugins = [
            envFileEnvironment.BEHAVE_PLUGINS,
            DISCOVERY_OUTPUT_PLUGIN_INFO.MODULE_NAME
        ].filter(item => item).join(',');

        return {
            ...envFileEnvironment,
            PYTHONPATH: updatedPythonPath,
            BEHAVE_PLUGINS: updatedBehavePlugins,
        };
    }

    private getDiscoveryArguments(rawBehaveArguments: string[]): IBehaveArguments {
        const argumentParser = this.configureCommonArgumentParser();
        const [knownArguments, argumentsToPass] = argumentParser.parse_known_args(rawBehaveArguments);
        return {
            locations: (knownArguments as { locations?: string[] }).locations || [],
            argumentsToPass: ['-d', '-f', 'json', '--no-summary', '--no-snippets'].concat(argumentsToPass),
        };
    }

    // @ts-expect-error
    private getRunArguments(test: string, rawBehaveArguments: string[]): IBehaveArguments {
        const argumentParser = this.configureCommonArgumentParser();
        const [knownArguments, argumentsToPass] = argumentParser.parse_known_args(rawBehaveArguments);
        return {
            locations: (knownArguments as { locations?: string[] }).locations || [],
            argumentsToPass: ['-f', 'json', '--no-summary', '--no-snippets'].concat(argumentsToPass),
        };
    }

    private configureCommonArgumentParser() {
        const argumentParser = new ArgumentParser({
            exit_on_error: false,
        });
        argumentParser.add_argument(
            '-D', '--define',
            { action: 'store', dest: 'define' });
        argumentParser.add_argument(
            '-e', '--exclude',
            { action: 'store', dest: 'exclude' });
        argumentParser.add_argument(
            '-i', '--include',
            { action: 'store', dest: 'include' });

        // Handle positional arguments (list of testsuite directories to run behave in).
        argumentParser.add_argument(
            'locations',
            { nargs: '*' });

        return argumentParser;
    }
}
