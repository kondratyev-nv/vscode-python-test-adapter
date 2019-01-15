import {
    TestEvent,
    TestSuiteInfo
} from 'vscode-test-adapter-api';
import { IWorkspaceConfiguration } from './configuration/workspaceConfiguration';

export interface IDebugConfiguration {
    module: string;
    cwd: string;
    args: string[];
    envFile: string;
}

export interface ITestRunner {
    readonly adapterId: string;

    load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined>;

    run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]>;

    debugConfiguration(config: IWorkspaceConfiguration, test: string): IDebugConfiguration;
}
