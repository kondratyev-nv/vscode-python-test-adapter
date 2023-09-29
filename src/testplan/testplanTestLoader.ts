import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

export interface ITestPlanTestLoader {
    getArgs(baseArguments: string[]): string[];
    parseOutput(output: string): (TestSuiteInfo | TestInfo)[];
}
