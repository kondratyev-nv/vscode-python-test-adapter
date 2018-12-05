import {
    TestEvent,
    TestSuiteInfo
} from 'vscode-test-adapter-api';
import { IWorkspaceConfiguration } from './workspaceConfiguration';

export interface ITestRunner {
    readonly adapterId: string;

    load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined>;

    run(config: IWorkspaceConfiguration, test: string): Promise<TestEvent[]>;
}
