import * as os from 'os';
import * as path from 'path';
import * as tmp from 'tmp';
import {
    TestEvent
} from 'vscode-test-adapter-api';

import { ArgumentParser } from 'argparse';
import { IWorkspaceConfiguration } from '../configuration/workspaceConfiguration';
import { EnvironmentVariablesLoader } from '../environmentVariablesLoader';
import { ILogger } from '../logging/logger';
import { IProcessExecution, runScript } from '../pythonRunner';
import { IDebugConfiguration, IDiscoveryResult, ITestRunner } from '../testRunner';
import { empty, setDescriptionForEqualLabels } from '../utilities';
import { parseTestStates } from './pytestJunitTestStatesParser';
import { parseTestSuites } from './pytestTestCollectionParser';

export class PytestTestRunner implements ITestRunner {
    private static readonly PYTEST_WRAPPER_SCRIPT = `
from __future__ import print_function

import pytest
import sys
import json
import py


def get_line_number(item):
    location = getattr(item, 'location', None)
    if location is not None:
        return location[1]
    obj = getattr(item, 'obj', None)
    if obj is not None:
        try:
            from _pytest.compat import getfslineno
            return getfslineno(obj)[1]
        except:
            pass
    return None


class PythonTestExplorerDiscoveryOutputPlugin(object):
    def __init__(self):
        self.errors = []

    def __extract_discovered_tests(self, session):
        tests = []
        for item in session.items:
            line = get_line_number(item)
            tests.append({'id': item.nodeid,
                            'line': line})
        return tests

    def __extract_discovery_errors(self):
        errors = []
        for error in self.errors:
            try:
                errors.append({'file': error.location[0] if error.location else None,
                                'message': error.longreprtext})
            except:
                pass
        return errors

    def pytest_collection_finish(self, session):
        print('==DISCOVERED TESTS BEGIN==')
        tests = self.__extract_discovered_tests(session)
        errors = self.__extract_discovery_errors()
        print(json.dumps({'tests': tests,
                            'errors': errors}))
        print('==DISCOVERED TESTS END==')

    def pytest_collectreport(self, report):
        if report.failed:
            self.errors.append(report)


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
            args: this.getRunArguments(test, config.getPytestConfiguration().pytestArguments),
            envFile: config.envFile(),
        };
    }

    public async load(config: IWorkspaceConfiguration): Promise<IDiscoveryResult> {
        if (!config.getPytestConfiguration().isPytestEnabled) {
            this.logger.log('info', 'Pytest test discovery is disabled');
            return { };
        }
        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), process.env, this.logger);
        this.logger.log('info', `Discovering tests using python path '${config.pythonPath()}' in ${config.getCwd()}`);

        const discoveryArguments = this.getDiscoveryArguments(config.getPytestConfiguration().pytestArguments);
        this.logger.log('info', `Running pytest wrapper with arguments: ${discoveryArguments}`);

        const result = await runScript({
            pythonPath: config.pythonPath(),
            script: PytestTestRunner.PYTEST_WRAPPER_SCRIPT,
            args: discoveryArguments,
            cwd: config.getCwd(),
            environment: additionalEnvironment,
        }).complete();

        const { suites, errors } = parseTestSuites(result.output, config.getCwd());
        if (!empty(errors)) {
            errors.forEach(error =>
                this.logger.log(
                    'warn',
                    `Error while collecting tests from file ${error.id}: ${os.EOL} ${error.message}`
                )
            );
        }
        if (empty(suites)) {
            this.logger.log('warn', 'No tests discovered');
            return { suite: undefined, errors };
        }

        setDescriptionForEqualLabels(suites, path.sep);
        return {
            suite: {
                type: 'suite',
                id: this.adapterId,
                label: 'Pytest tests',
                children: suites,
            },
            errors,
        };
    }

    public async run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]> {
        this.logger.log('info', `Running tests using python path '${config.pythonPath()}' in ${config.getCwd()}`);

        const additionalEnvironment = await EnvironmentVariablesLoader.load(config.envFile(), process.env, this.logger);
        const { file, cleanupCallback } = await this.createTemporaryFile();
        const runArguments = [`--junitxml=${file}`].concat(
            this.getRunArguments(test, config.getPytestConfiguration().pytestArguments));
        this.logger.log('info', `Running pytest wrapper with arguments: ${runArguments}`);
        const testExecution = runScript({
            pythonPath: config.pythonPath(),
            script: PytestTestRunner.PYTEST_WRAPPER_SCRIPT,
            cwd: config.getCwd(),
            args: runArguments,
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

    private getDiscoveryArguments(rawPytestArguments: string[]): string[] {
        const argumentParser = this.configureCommonArgumentParser();
        const [, argumentsToPass] = argumentParser.parseKnownArgs(rawPytestArguments);
        return ['--collect-only'].concat(argumentsToPass);
    }

    private getRunArguments(test: string, rawPytestArguments: string[]): string[] {
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
        const [, argumentsToPass] = argumentParser.parseKnownArgs(rawPytestArguments);
        return argumentsToPass.concat(test !== this.adapterId ? [test] : []);
    }

    private configureCommonArgumentParser() {
        const argumentParser = new ArgumentParser();
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
