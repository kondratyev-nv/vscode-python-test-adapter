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
import { parseTestStates } from './pytestJunitTestStatesParser';
import { parseTestSuites } from './pytestTestCollectionParser';

// --- Pytest Exit Codes ---
// 0: All tests were collected and passed successfully
// 1: Tests were collected and run but some of the tests failed
// 2: Test execution was interrupted by the user
// 3: Internal error happened while executing tests
// 4: pytest command line usage error
// 5: No tests were collected
// See https://docs.pytest.org/en/stable/usage.html#possible-exit-codes
const PYTEST_NON_ERROR_EXIT_CODES = [0, 1, 2, 5];

const DISCOVERY_OUTPUT_PLUGIN_INFO = {
    PACKAGE_PATH: path.resolve(__dirname, '../../python_resources'),
    MODULE_NAME: 'vscode_python_test_adapter.pytest.discovery_output_plugin',
};

interface IRunArguments {
    junitReportPath?: string;
    argumentsToPass: string[];
}

export class PytestTestRunner implements ITestRunner {

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
        const runArguments = this.getRunArguments(test, config.getPytestConfiguration().pytestArguments);
        return {
            module: 'pytest',
            cwd: config.getCwd(),
            args: runArguments.argumentsToPass,
            env: additionalEnvironment,
        };
    }

    public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
        if (!config.getPytestConfiguration().isPytestEnabled) {
            this.logger.log('info', 'Pytest test discovery is disabled');
            return undefined;
        }
        const additionalEnvironment = await this.loadEnvironmentVariables(config);
        this.logger.log('info', `Discovering tests using python path '${config.pythonPath()}' in ${config.getCwd()}`);

        const discoveryArguments = this.getDiscoveryArguments(config.getPytestConfiguration().pytestArguments);
        this.logger.log('info', `Running pytest wrapper with arguments: ${discoveryArguments}`);

        const result = await runProcess(
            config.getPytestConfiguration().pytestPath(),
            discoveryArguments,
            {
                cwd: config.getCwd(),
                environment: additionalEnvironment,
                acceptedExitCodes: PYTEST_NON_ERROR_EXIT_CODES,
            }).complete();

        const tests = parseTestSuites(result.output, config.getCwd());
        if (empty(tests)) {
            this.logger.log('warn', 'No tests discovered');
            return undefined;
        }

        setDescriptionForEqualLabels(tests, path.sep);
        return {
            type: 'suite',
            id: this.adapterId,
            label: 'Pytest tests',
            children: tests,
        };
    }

    public async run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]> {
        this.logger.log('info', `Running tests using python path '${config.pythonPath()}' in ${config.getCwd()}`);

        const additionalEnvironment = await this.loadEnvironmentVariables(config);
        const runArguments = this.getRunArguments(test, config.getPytestConfiguration().pytestArguments);
        const { file, cleanupCallback } = await this.getJunitReportPath(config.getCwd(), runArguments);
        const testRunArguments = [
            `--junitxml=${file}`,
            '--override-ini', 'junit_logging=all',
            '--override-ini', 'junit_family=xunit1'
        ].concat(runArguments.argumentsToPass);

        this.logger.log('info', `Running pytest with arguments: ${testRunArguments}`);
        const testExecution = runProcess(
            config.getPytestConfiguration().pytestPath(),
            testRunArguments,
            {
                cwd: config.getCwd(),
                environment: additionalEnvironment,
                acceptedExitCodes: PYTEST_NON_ERROR_EXIT_CODES,
            });
        this.testExecutions.set(test, testExecution);
        await testExecution.complete();
        this.testExecutions.delete(test);
        this.logger.log('info', 'Test execution completed');
        const states = await parseTestStates(file, config.getCwd());

        cleanupCallback();
        return states;
    }

    private async loadEnvironmentVariables(config: IWorkspaceConfiguration): Promise<IEnvironmentVariables> {
        const environment = await EnvironmentVariablesLoader.load(config.envFile(), process.env, this.logger);

        const updatedPythonPath = [
            config.getCwd(),
            environment.PYTHONPATH,
            DISCOVERY_OUTPUT_PLUGIN_INFO.PACKAGE_PATH
        ].filter(item => item).join(path.delimiter);

        const updatedPytestPlugins = [
            environment.PYTEST_PLUGINS,
            DISCOVERY_OUTPUT_PLUGIN_INFO.MODULE_NAME
        ].filter(item => item).join(',');

        return {
            ...environment,
            PYTHONPATH: updatedPythonPath,
            PYTEST_PLUGINS: updatedPytestPlugins,
        };
    }

    private async getJunitReportPath(
        cwd: string,
        runArguments: IRunArguments
    ): Promise<{ file: string, cleanupCallback: () => void }> {
        if (runArguments.junitReportPath) {
            return Promise.resolve({
                file: path.resolve(cwd, runArguments.junitReportPath),
                cleanupCallback: () => { /* intentionally empty */ },
            });
        }
        return await this.createTemporaryFile();
    }

    private getDiscoveryArguments(rawPytestArguments: string[]): string[] {
        const argumentParser = this.configureCommonArgumentParser();
        const [, argumentsToPass] = argumentParser.parseKnownArgs(rawPytestArguments);
        return ['--collect-only'].concat(argumentsToPass);
    }

    private getRunArguments(test: string, rawPytestArguments: string[]): IRunArguments {
        const argumentParser = this.configureCommonArgumentParser();
        argumentParser.addArgument(
            ['--setuponly', '--setup-only'],
            { action: 'storeTrue' });
        argumentParser.addArgument(
            ['--setupshow', '--setup-show'],
            { action: 'storeTrue' });
        argumentParser.addArgument(
            ['--setupplan', '--setup-plan'],
            { action: 'storeTrue' });
        argumentParser.addArgument(
            ['--collectonly', '--collect-only'],
            { action: 'storeTrue' });
        argumentParser.addArgument(
            ['--trace'],
            { dest: 'trace', action: 'storeTrue' });

        // Handle positional arguments (list of tests to run).
        // We hande them only in 'Run' configuration, because they might be used as filter on discovery stage.
        argumentParser.addArgument(
            ['tests'],
            { nargs: '*' });

        const [knownArguments, argumentsToPass] = argumentParser.parseKnownArgs(rawPytestArguments);
        return {
            junitReportPath: (knownArguments as { xmlpath?: string }).xmlpath,
            argumentsToPass: argumentsToPass.concat(
                test !== this.adapterId ?
                    [test] :
                    (knownArguments as { tests?: string[] }).tests || []
            ),
        };
    }

    private configureCommonArgumentParser() {
        const argumentParser = new ArgumentParser({
            debug: true, // Argument errors throw exception in debug mode and process.exit in normal.
        });
        argumentParser.addArgument(
            ['--rootdir'],
            { action: 'store', dest: 'rootdir' });
        argumentParser.addArgument(
            ['-x', '--exitfirst'],
            { dest: 'maxfail', action: 'storeConst', constant: 1 });
        argumentParser.addArgument(
            ['--maxfail'],
            { dest: 'maxfail', action: 'store', defaultValue: 0 });
        argumentParser.addArgument(
            ['--fixtures', '--funcargs'],
            { action: 'storeTrue', dest: 'showfixtures', defaultValue: false });
        argumentParser.addArgument(
            ['--fixtures-per-test'],
            { action: 'storeTrue', dest: 'show_fixtures_per_test', defaultValue: false });
        argumentParser.addArgument(
            ['--lf', '--last-failed'],
            { action: 'storeTrue', dest: 'lf' });
        argumentParser.addArgument(
            ['--ff', '--failed-first'],
            { action: 'storeTrue', dest: 'failedfirst' });
        argumentParser.addArgument(
            ['--nf', '--new-first'],
            { action: 'storeTrue', dest: 'newfirst' });
        argumentParser.addArgument(
            ['--cache-show'],
            { action: 'storeTrue', dest: 'cacheshow' });
        argumentParser.addArgument(
            ['--lfnf', '--last-failed-no-failures'],
            { action: 'store', dest: 'last_failed_no_failures', choices: ['all', 'none'], defaultValue: 'all' });
        argumentParser.addArgument(
            ['--pdb'],
            { dest: 'usepdb', action: 'storeTrue' });
        argumentParser.addArgument(
            ['--pdbcls'],
            { dest: 'usepdb_cls' });
        argumentParser.addArgument(
            ['--junitxml', '--junit-xml'],
            { action: 'store', dest: 'xmlpath' });
        argumentParser.addArgument(
            ['--junitprefix', '--junit-prefix'],
            { action: 'store' });
        return argumentParser;
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
