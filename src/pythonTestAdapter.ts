import {
    debug,
    Event,
    EventEmitter,
    WorkspaceFolder,
    DebugConfiguration,
    workspace,
    OutputChannel,
    window,
} from 'vscode';
import {
    TestAdapter,
    TestEvent,
    TestInfo,
    TestLoadFinishedEvent,
    TestLoadStartedEvent,
    TestRunFinishedEvent,
    TestRunStartedEvent,
    TestSuiteEvent,
    TestSuiteInfo,
} from 'vscode-test-adapter-api';

import { IConfigurationFactory } from './configuration/configurationFactory';
import { ILogger } from './logging/logger';
import { ITestRunner } from './testRunner';
import * as path from 'path';
import { EOL } from 'os';
import { parse } from 'jsonc-parser';
import { isFileExists, readFile } from './utilities/fs';
import { empty, firstOrDefault } from './utilities/collections';
import { concatNonEmpty } from './utilities/strings';
import { IEnvironmentVariables, EnvironmentVariablesLoader } from './environmentVariablesLoader';
import { LoggingOutputCollector } from './loggingOutputCollector';

type TestRunEvent = TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent;

interface IPythonTestDebugConfig {
    env?: IEnvironmentVariables;

    name: string;
    console?: string;
    stopOnEntry?: boolean;
    showReturnValue?: boolean;
    redirectOutput?: boolean;
    debugStdLib?: boolean;
    justMyCode?: boolean;
    subProcess?: boolean;
    envFile?: string;
}

export class PythonTestAdapter implements TestAdapter {
    get tests(): Event<TestLoadStartedEvent | TestLoadFinishedEvent> {
        return this.testsEmitter.event;
    }

    get testStates(): Event<TestRunEvent> {
        return this.testStatesEmitter.event;
    }

    get autorun(): Event<void> {
        return this.autorunEmitter.event;
    }

    private disposables: { dispose(): void }[] = [];
    private readonly testsEmitter = new EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
    private readonly testStatesEmitter = new EventEmitter<TestRunEvent>();
    private readonly autorunEmitter = new EventEmitter<void>();

    private readonly testsById = new Map<string, TestSuiteInfo | TestInfo>();
    private readonly testsByFsPath = new Map<string, TestSuiteInfo | TestInfo>();

    private outputChannel: OutputChannel | undefined;

    constructor(
        public readonly name: string,
        public readonly workspaceFolder: WorkspaceFolder,
        private readonly testRunner: ITestRunner,
        private readonly configurationFactory: IConfigurationFactory,
        private readonly logger: ILogger
    ) {
        this.disposables = [this.testsEmitter, this.testStatesEmitter, this.autorunEmitter];
        this.registerActions();
    }

    private registerActions() {
        this.disposables.push(
            workspace.onDidChangeConfiguration(async (configurationChange) => {
                const sectionsToReload = [
                    'python.pythonPath',
                    'python.envFile',
                    'python.testing.cwd',
                    'python.testing.unittestEnabled',
                    'python.testing.unittestArgs',
                    'python.testing.pytestEnabled',
                    'python.testing.pytestPath',
                    'python.testing.pytestArgs',
                    'pythonTestExplorer.testFramework',
                ];

                const needsReload = sectionsToReload.some((section) =>
                    configurationChange.affectsConfiguration(section, this.workspaceFolder.uri)
                );
                if (needsReload) {
                    this.logger.log('info', 'Configuration changed, reloading tests');
                    this.load();
                }
            })
        );

        this.disposables.push(
            workspace.onDidSaveTextDocument(async (document) => {
                const config = await this.configurationFactory.get(this.workspaceFolder);
                if (config.autoTestDiscoverOnSaveEnabled()) {
                    const filename = document.fileName;
                    if (this.testsByFsPath.has(filename)) {
                        this.logger.log('debug', 'Test file changed, reloading tests');
                        await this.load();
                        return; // In case autorun is enabled - execution will be triggered on load.
                    }
                    if (filename.startsWith(this.workspaceFolder.uri.fsPath)) {
                        this.logger.log('debug', 'Sending autorun event');
                        this.autorunEmitter.fire();
                    }
                }
            })
        );
    }

    public async load(): Promise<void> {
        try {
            this.testsEmitter.fire({ type: 'started' });

            this.testsById.clear();
            this.testsByFsPath.clear();
            const config = await this.configurationFactory.get(this.workspaceFolder);
            const suite = await this.testRunner.load(config);
            this.saveToMap(suite);
            this.sortTests(suite);

            this.testsEmitter.fire({ type: 'finished', suite });
        } catch (error: any) {
            const errorMessage = `Test loading failed: ${concatNonEmpty(EOL, error, error.stack)}`;
            this.logger.log('crit', errorMessage);
            this.testsEmitter.fire({ type: 'finished', suite: undefined, errorMessage });
        }
    }

    public async run(tests: string[]): Promise<void> {
        try {
            this.testStatesEmitter.fire({ type: 'started', tests });
            const config = await this.configurationFactory.get(this.workspaceFolder);

            let collector: LoggingOutputCollector | undefined;

            if (config.collectOutputs()) {
                const outputChannel = this.getOutputChannel();
                collector = new LoggingOutputCollector(outputChannel);
                outputChannel.clear();
                if (config.showOutputsOnRun()) {
                    outputChannel.show();
                }
            }

            const testRuns = tests.map(async (test) => {
                try {
                    const states = await this.testRunner.run(config, test, collector);
                    return states.forEach((state) => {
                        const testId = state.test as string;
                        if (this.testsById.has(testId) && this.testsById.get(testId)?.type === 'suite') {
                            this.setTestStatesRecursive(testId, state.state, state.message);
                        } else {
                            this.testStatesEmitter.fire(state);
                        }
                    });
                } catch (reason: any) {
                    this.logger.log('crit', `Execution of the test "${test}" failed: ${reason}`);
                    this.setTestStatesRecursive(test, 'failed', reason);
                }
            });
            await Promise.all(testRuns);
        } finally {
            this.testStatesEmitter.fire({ type: 'finished' });
        }
    }

    public async debug(tests: string[]): Promise<void> {
        const config = await this.configurationFactory.get(this.workspaceFolder);
        const debugConfiguration = await this.testRunner.debugConfiguration(config, tests[0]);
        const launchJsonConfiguration = await this.detectDebugConfiguration(
            this.testsById.get(tests[0])?.label || tests[0],
            debugConfiguration.env
        );
        return new Promise<void>(() => {
            debug
                .startDebugging(this.workspaceFolder, {
                    ...{
                        type: 'python',
                        request: 'launch',
                        console: 'internalConsole',
                    },
                    ...debugConfiguration, // module, cwd, args, env,
                    ...launchJsonConfiguration,
                })
                .then(
                    () => {
                        /* intentionally omitted */
                    },
                    (exception) => this.logger.log('crit', `Failed to start debugging tests: ${exception}`)
                );
        });
    }

    public cancel(): void {
        this.testRunner.cancel();
    }

    public dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }

    private sortTests(test: TestSuiteInfo | undefined): void {
        if (!test) {
            return;
        }
        test.children.sort((x, y) => x.label.localeCompare(y.label, undefined, { sensitivity: 'base', numeric: true }));
        test.children
            .filter((t) => t)
            .filter((t) => t.type === 'suite')
            .map((t) => t as TestSuiteInfo)
            .forEach((t) => this.sortTests(t));
    }

    private saveToMap(test: TestSuiteInfo | TestInfo | undefined) {
        if (!test) {
            return;
        }
        this.testsById.set(test.id, test);
        if (test.file) {
            this.testsByFsPath.set(test.file, test);
        }
        if (test.type === 'suite') {
            test.children.forEach((child) => this.saveToMap(child));
        }
    }

    private setTestStatesRecursive(
        test: string,
        state: 'running' | 'passed' | 'failed' | 'skipped' | 'errored',
        message?: string | undefined
    ) {
        const info = this.testsById.get(test);
        if (!info) {
            this.logger.log('warn', `Test information for "${test}" not found`);
            return;
        }
        if (info.type === 'suite') {
            info.children.forEach((child) => this.setTestStatesRecursive(child.id, state, message));
        } else {
            this.testStatesEmitter.fire(<TestEvent>{
                type: 'test',
                test: info.id,
                state,
                message,
            });
        }
    }

    private async detectDebugConfiguration(
        test: string,
        globalEnvironment: IEnvironmentVariables
    ): Promise<IPythonTestDebugConfig> {
        const emptyJsonConfiguration = {
            name: `Debug: ${test}`,
        };

        const filename = path.join(this.workspaceFolder.uri.fsPath, '.vscode', 'launch.json');
        const launchJsonFileExists = await isFileExists(filename);
        if (!launchJsonFileExists) {
            return emptyJsonConfiguration;
        }
        try {
            const content = await readFile(filename);
            const launchJsonConfiguration = parse(content, [], { allowTrailingComma: true, disallowComments: false });
            if (!launchJsonConfiguration.version || empty(launchJsonConfiguration.configurations)) {
                this.logger.log('warn', `No debug configurations in ${filename}`);
            }
            return firstOrDefault(
                (launchJsonConfiguration.configurations as DebugConfiguration[])
                    .filter((cfg) => this.isTestConfiguration(cfg))
                    .map((cfg) => cfg as IPythonTestDebugConfig)
                    .map(
                        (cfg) =>
                            <IPythonTestDebugConfig>{
                                env: EnvironmentVariablesLoader.merge(cfg.env || {}, globalEnvironment),

                                name: `${cfg.name}: ${test}`,
                                console: cfg.console,
                                stopOnEntry: cfg.stopOnEntry,
                                showReturnValue: cfg.showReturnValue,
                                redirectOutput: cfg.redirectOutput,
                                debugStdLib: cfg.debugStdLib,
                                justMyCode: cfg.justMyCode,
                                subProcess: cfg.subProcess,
                                envFile: cfg.envFile,
                            }
                    ),
                emptyJsonConfiguration
            );
        } catch (error) {
            this.logger.log('crit', `Could not load debug configuration: ${error}`);
            return emptyJsonConfiguration;
        }
    }

    private isTestConfiguration(cfg: DebugConfiguration): boolean {
        if (!cfg.name) {
            return false;
        }
        if (cfg.type !== 'python') {
            return false;
        }
        if (cfg.request === 'test') {
            return true;
        }
        const purpose = cfg.purpose as string[] | undefined;
        return purpose?.includes('debug-test') ?? false;
    }

    private getOutputChannel(): OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = window.createOutputChannel(
                `${this.name} - ${this.workspaceFolder.name} - Execution`,
                'Log'
            );
        }
        return this.outputChannel;
    }
}
