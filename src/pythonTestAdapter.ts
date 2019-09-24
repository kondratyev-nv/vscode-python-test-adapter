import { debug, Event, EventEmitter, WorkspaceFolder } from 'vscode';
import {
    TestAdapter,
    TestEvent,
    TestInfo,
    TestLoadFinishedEvent,
    TestLoadStartedEvent,
    TestRunFinishedEvent,
    TestRunStartedEvent,
    TestSuiteEvent,
    TestSuiteInfo
} from 'vscode-test-adapter-api';

import { IConfigurationFactory } from './configuration/configurationFactory';
import { ILogger } from './logging/logger';
import { ITestRunner } from './testRunner';

type TestRunEvent = TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent;

export class PythonTestAdapter implements TestAdapter {

    get tests(): Event<TestLoadStartedEvent | TestLoadFinishedEvent> { return this.testsEmitter.event; }

    get testStates(): Event<TestRunEvent> {
        return this.testStatesEmitter.event;
    }

    get autorun(): Event<void> {
        return this.autorunEmitter.event;
    }

    private disposables: Array<{ dispose(): void }> = [];
    private readonly testsEmitter = new EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
    private readonly testStatesEmitter = new EventEmitter<TestRunEvent>();
    private readonly autorunEmitter = new EventEmitter<void>();

    private readonly testsById = new Map<string, TestSuiteInfo | TestInfo>();

    constructor(
        public readonly workspaceFolder: WorkspaceFolder,
        private readonly testRunner: ITestRunner,
        private readonly configurationFactory: IConfigurationFactory,
        private readonly logger: ILogger
    ) {
        this.disposables = [
            this.testsEmitter,
            this.testStatesEmitter,
            this.autorunEmitter
        ];
    }

    public async load(): Promise<void> {
        try {
            this.testsEmitter.fire({ type: 'started' });

            this.testsById.clear();
            const config = this.configurationFactory.get(this.workspaceFolder);
            const { suite, errors } = await this.testRunner.load(config);
            this.saveToMap(suite);
            this.sortTests(suite);

            this.testsEmitter.fire({ type: 'finished', suite });
            errors.map(e => ({
                type: 'test' as 'test',
                test: e.id,
                state: 'errored' as 'errored',
                message: e.message,
            })).forEach(state => this.testStatesEmitter.fire(state));
        } catch (error) {
            this.logger.log('crit', `Test loading failed: ${error}`);
            this.testsEmitter.fire({ type: 'finished', suite: undefined, errorMessage: error.stack });
        }
    }

    public async run(tests: string[]): Promise<void> {
        try {
            this.testStatesEmitter.fire({ type: 'started', tests });
            const config = this.configurationFactory.get(this.workspaceFolder);
            const testRuns = tests.map(async test => {
                try {
                    const states = await this.testRunner.run(config, test);
                    return states.forEach(state => this.testStatesEmitter.fire(state));
                } catch (reason) {
                    this.logger.log('crit', `Execution of the test "${test}" failed: ${reason}`);
                    this.setTestStatesRecursive(test, 'failed', reason);
                }
            });
            await Promise.all(testRuns);
        } finally {
            this.testStatesEmitter.fire({ type: 'finished' });
        }
    }

    public debug(tests: string[]): Promise<void> {
        const config = this.configurationFactory.get(this.workspaceFolder);
        const debugConfiguration = this.testRunner.debugConfiguration(config, tests[0]);
        return new Promise<void>(() => {
            debug.startDebugging(this.workspaceFolder, {
                ...{
                    name: `Debug ${tests[0]}`,
                    type: 'python',
                    request: 'launch',
                    console: 'none',
                },
                ...debugConfiguration,
            }).then(() => { /* intentionally omitted */ });
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
        test.children.filter(t => t)
            .filter(t => t.type === 'suite')
            .map(t => t as TestSuiteInfo)
            .forEach(t => this.sortTests(t));
    }

    private saveToMap(test: TestSuiteInfo | TestInfo | undefined) {
        if (!test) {
            return;
        }
        this.testsById.set(test.id, test);
        if (test.type === 'suite') {
            test.children.forEach(child => this.saveToMap(child));
        }
    }

    private setTestStatesRecursive(
        test: string,
        state: 'running' | 'passed' | 'failed' | 'skipped',
        message?: string | undefined
    ) {
        const info = this.testsById.get(test);
        if (!info) {
            this.logger.log('warn', `Test information for "${test}" not found`);
            return;
        }
        if (info.type === 'suite') {
            info.children.forEach(child =>
                this.setTestStatesRecursive(child.id, state, message)
            );
        } else {
            this.testStatesEmitter.fire(<TestEvent>{
                type: 'test',
                test: info.id,
                state,
                message,
            });
        }
    }
}
