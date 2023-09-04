import { TestEvent, TestSuiteInfo } from 'vscode-test-adapter-api';
import { IWorkspaceConfiguration } from './configuration/workspaceConfiguration';
import { IEnvironmentVariables } from './environmentVariablesLoader';
import { IProcessOutputCollector } from './processRunner';

export interface IDebugConfiguration {
    program?: string;
    module?: string;
    cwd: string;
    args: string[];
    env: IEnvironmentVariables;
}

export interface ITestRunner {
    readonly adapterId: string;

    load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined>;

    run(
        config: IWorkspaceConfiguration,
        test: string,
        outputCollector: IProcessOutputCollector | undefined
    ): Promise<TestEvent[]>;

    cancel(): void;

    debugConfiguration(config: IWorkspaceConfiguration, test: string): Promise<IDebugConfiguration>;
}
