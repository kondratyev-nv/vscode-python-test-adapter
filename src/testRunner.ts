import { TestEvent, TestSuiteInfo } from 'vscode-test-adapter-api';
import { IWorkspaceConfiguration } from './configuration/workspaceConfiguration';
import { IEnvironmentVariables } from './environmentVariablesLoader';

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

    run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]>;

    cancel(): void;

    debugConfiguration(
        config: IWorkspaceConfiguration,
        test: string
    ): Promise<IDebugConfiguration>;
}
