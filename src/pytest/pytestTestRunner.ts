import * as path from 'path';
import * as tmp from 'tmp';
import { TestEvent, TestSuiteInfo } from 'vscode-test-adapter-api';

import { ArgumentParser } from 'argparse';
import { IWorkspaceConfiguration } from '../configuration/workspaceConfiguration';
import { IEnvironmentVariables, EnvironmentVariablesLoader } from '../environmentVariablesLoader';
import { ILogger } from '../logging/logger';
import { IProcessExecution, runProcess } from '../processRunner';
import { IDebugConfiguration, ITestRunner } from '../testRunner';
import { empty } from '../utilities/collections';
import { setDescriptionForEqualLabels } from '../utilities/tests';
import { parseTestStates } from './pytestJunitTestStatesParser';
import { parseTestSuites } from './pytestTestCollectionParser';
import { runModule } from '../pythonRunner';

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
    PACKAGE_PATH: path.resolve(__dirname, '../../resources/python'),
    MODULE_NAME: 'vscode_python_test_adapter.pytest.discovery_output_plugin',
};

interface IRunArguments {
    junitReportPath?: string;
    argumentsToPass: string[];
}

export class PytestTestRunner implements ITestRunner {
    private readonly testExecutions: Map<string, IProcessExecution> = new Map<string, IProcessExecution>();

    constructor(public readonly adapterId: string, private readonly logger: ILogger) {}

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
        this.logger.log('info', `Running pytest with arguments: ${discoveryArguments.join(', ')}`);

        const result = await this.runPytest(config, additionalEnvironment, discoveryArguments).complete();
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
        if (!config.getPytestConfiguration().isPytestEnabled) {
            this.logger.log('info', 'Pytest test execution is disabled');
            return [];
        }
        this.logger.log('info', `Running tests using python path '${config.pythonPath()}' in ${config.getCwd()}`);

        const additionalEnvironment = await this.loadEnvironmentVariables(config);
        const runArguments = this.getRunArguments(test, config.getPytestConfiguration().pytestArguments);
        const { file, cleanupCallback } = await this.getJunitReportPath(config.getCwd(), runArguments);
        const testRunArguments = [
            // HACK: for #198. When running specific suite pytest may detect other rootdir.
            // See https://docs.pytest.org/en/stable/customize.html#finding-the-rootdir
            `--rootdir=${config.getCwd()}`,
            `--junitxml=${file}`,
            '--override-ini',
            'junit_family=xunit1',
        ].concat(runArguments.argumentsToPass);
        this.logger.log('info', `Running pytest with arguments: ${testRunArguments.join(', ')}`);

        const testExecution = this.runPytest(config, additionalEnvironment, testRunArguments);
        this.testExecutions.set(test, testExecution);
        await testExecution.complete();
        this.testExecutions.delete(test);

        this.logger.log('info', 'Test execution completed');
        const states = await parseTestStates(file, config.getCwd());

        cleanupCallback();
        return states;
    }

    private runPytest(config: IWorkspaceConfiguration, env: IEnvironmentVariables, args: string[]): IProcessExecution {
        const pytestPath = config.getPytestConfiguration().pytestPath();
        if (pytestPath === path.basename(pytestPath)) {
            this.logger.log('info', `Running ${pytestPath} as a Python module`);
            return runModule({
                pythonPath: config.pythonPath(),
                module: config.getPytestConfiguration().pytestPath(),
                environment: env,
                args,
                cwd: config.getCwd(),
                acceptedExitCodes: PYTEST_NON_ERROR_EXIT_CODES,
            });
        }

        this.logger.log('info', `Running ${pytestPath} as an executable`);
        return runProcess(pytestPath, args, {
            cwd: config.getCwd(),
            environment: env,
            acceptedExitCodes: PYTEST_NON_ERROR_EXIT_CODES,
        });
    }

    private async loadEnvironmentVariables(config: IWorkspaceConfiguration): Promise<IEnvironmentVariables> {
        const envFileEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), process.env, this.logger);

        const updatedPythonPath = [
            config.getCwd(),
            envFileEnvironment.PYTHONPATH,
            process.env.PYTHONPATH,
            DISCOVERY_OUTPUT_PLUGIN_INFO.PACKAGE_PATH,
        ]
            .filter((item) => item)
            .join(path.delimiter);

        const updatedPytestPlugins = [envFileEnvironment.PYTEST_PLUGINS, DISCOVERY_OUTPUT_PLUGIN_INFO.MODULE_NAME]
            .filter((item) => item)
            .join(',');

        return {
            ...envFileEnvironment,
            PYTHONPATH: updatedPythonPath,
            PYTEST_PLUGINS: updatedPytestPlugins,
        };
    }

    private async getJunitReportPath(
        cwd: string,
        runArguments: IRunArguments
    ): Promise<{ file: string; cleanupCallback: () => void }> {
        if (runArguments.junitReportPath) {
            return Promise.resolve({
                file: path.resolve(cwd, runArguments.junitReportPath),
                cleanupCallback: () => {
                    /* intentionally empty */
                },
            });
        }
        return await this.createTemporaryFile();
    }

    private getDiscoveryArguments(rawPytestArguments: string[]): string[] {
        const argumentParser = this.configureCommonArgumentParser();
        const [, argumentsToPass] = argumentParser.parse_known_args(rawPytestArguments);
        return ['--collect-only'].concat(argumentsToPass);
    }

    private getRunArguments(test: string, rawPytestArguments: string[]): IRunArguments {
        const argumentParser = this.configureCommonArgumentParser();
        argumentParser.add_argument('--setuponly', '--setup-only', { action: 'store_true' });
        argumentParser.add_argument('--setupshow', '--setup-show', { action: 'store_true' });
        argumentParser.add_argument('--setupplan', '--setup-plan', { action: 'store_true' });
        argumentParser.add_argument('--collectonly', '--collect-only', { action: 'store_true' });
        argumentParser.add_argument('--trace', { dest: 'trace', action: 'store_true' });

        // Handle positional arguments (list of tests to run).
        // We hande them only in 'Run' configuration, because they might be used as filter on discovery stage.
        argumentParser.add_argument('tests', { nargs: '*' });

        const [knownArguments, argumentsToPass] = argumentParser.parse_known_args(rawPytestArguments);
        return {
            junitReportPath: (knownArguments as { xmlpath?: string }).xmlpath,
            argumentsToPass: argumentsToPass.concat(
                test !== this.adapterId ? [test] : (knownArguments as { tests?: string[] }).tests || []
            ),
        };
    }

    private configureCommonArgumentParser() {
        const argumentParser = new ArgumentParser({
            exit_on_error: false,
        });
        argumentParser.add_argument('--rootdir', { action: 'store', dest: 'rootdir' });
        argumentParser.add_argument('-x', '--exitfirst', { dest: 'maxfail', action: 'store_const', const: 1 });
        argumentParser.add_argument('--maxfail', { dest: 'maxfail', action: 'store', default: 0 });
        argumentParser.add_argument('--fixtures', '--funcargs', {
            action: 'store_true',
            dest: 'showfixtures',
            default: false,
        });
        argumentParser.add_argument('--fixtures-per-test', {
            action: 'store_true',
            dest: 'show_fixtures_per_test',
            default: false,
        });
        argumentParser.add_argument('--lf', '--last-failed', { action: 'store_true', dest: 'lf' });
        argumentParser.add_argument('--ff', '--failed-first', { action: 'store_true', dest: 'failedfirst' });
        argumentParser.add_argument('--nf', '--new-first', { action: 'store_true', dest: 'newfirst' });
        argumentParser.add_argument('--cache-show', { action: 'store_true', dest: 'cacheshow' });
        argumentParser.add_argument('--lfnf', '--last-failed-no-failures', {
            action: 'store',
            dest: 'last_failed_no_failures',
            choices: ['all', 'none'],
            default: 'all',
        });
        argumentParser.add_argument('--pdb', { dest: 'usepdb', action: 'store_true' });
        argumentParser.add_argument('--pdbcls', { dest: 'usepdb_cls' });
        argumentParser.add_argument('--junitxml', '--junit-xml', { action: 'store', dest: 'xmlpath' });
        argumentParser.add_argument('--junitprefix', '--junit-prefix', { action: 'store' });
        return argumentParser;
    }

    private async createTemporaryFile(): Promise<{ file: string; cleanupCallback: () => void }> {
        return new Promise<{ file: string; cleanupCallback: () => void }>((resolve, reject) => {
            tmp.file((error, file, _, cleanupCallback) => {
                if (error) {
                    reject(new Error(`Can not create temporary file ${file}: ${error}`));
                }
                resolve({ file, cleanupCallback });
            });
        });
    }
}
