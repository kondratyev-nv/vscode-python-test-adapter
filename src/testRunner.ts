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

export interface IDiscoveryResult {
    suite?: TestSuiteInfo;
    errors?: Array<{ id: string, message: string }>;
}

export interface ITestRunner {
    readonly adapterId: string;

    load(config: IWorkspaceConfiguration): Promise<IDiscoveryResult>;

    run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]>;

    cancel(): void;

    debugConfiguration(config: IWorkspaceConfiguration, test: string): IDebugConfiguration;
}
