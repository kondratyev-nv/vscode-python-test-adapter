import * as path from 'path';
import * as vscode from 'vscode';

import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { PlaceholderAwareWorkspaceConfiguration } from '../../src/configuration/placeholderAwareWorkspaceConfiguration';
import {
    IPytestConfiguration,
    IUnittestConfiguration,
    IWorkspaceConfiguration
} from '../../src/configuration/workspaceConfiguration';
import { ILogger } from '../../src/logging/logger';
import { getPythonExecutable } from './testConfiguration';

export function logger(): ILogger {
    return {
        log(level: 'info' | 'warn' | 'crit', message: string): void {
            if (process.env.ENABLE_TEST_LOGGING) {
                console.log(`${level}: ${message}`);
            }
        },
    };
}
export function extractErroredTestsFromArray(tests: (TestSuiteInfo | TestInfo)[]): (TestSuiteInfo | TestInfo)[] {
    let errors: (TestSuiteInfo | TestInfo)[] = [];
    for (const test of tests) {
        errors = errors.concat(extractErroredTests(test));
    }
    return errors;
}

export function extractErroredTests(suite: TestSuiteInfo | TestInfo): (TestSuiteInfo | TestInfo)[] {
    let errors = [];
    if (suite.errored) {
        errors.push(suite);
    }
    if (suite.type === 'suite') {
        errors = errors.concat(extractErroredTestsFromArray(suite.children));
    }
    return errors;
}

export function extractExpectedState(name: string) {
    if (name.includes('[')) {
        name = name.split('[')[0];
    }
    return name.split('_').slice(-1)[0];
}

export function findTestSuiteByLabel(
    suite: TestSuiteInfo | TestInfo,
    label: string,
    description?: string
): TestSuiteInfo | TestInfo | undefined {

    if (suite.label === label) {
        if (description) {
            if (suite.description === description) {
                return suite;
            }
        } else {
            if (!suite.description) {
                return suite;
            }
        }
    }
    if (suite.type === 'test') {
        return undefined;
    }
    for (const child of suite.children) {
        const r = findTestSuiteByLabel(child, label, description);
        if (r !== undefined) {
            return r;
        }
    }
    return undefined;
}

export function findWorkspaceFolder(folder: string): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders!.find(f => f.name === folder);
}

export function createPytestConfiguration(folder: string, args?: string[]): IWorkspaceConfiguration {
    const python = getPythonExecutable();
    const wf = findWorkspaceFolder(folder)!;
    return new PlaceholderAwareWorkspaceConfiguration({
        pythonPath(): string {
            return python;
        },
        getCwd(): string {
            return wf.uri.fsPath;
        },
        envFile(): string {
            return path.join(wf.uri.fsPath, '..', '.env');
        },
        getUnittestConfiguration(): IUnittestConfiguration {
            throw new Error();
        },
        getPytestConfiguration(): IPytestConfiguration {
            return {
                isPytestEnabled: true,
                pytestArguments: args || [],
            };
        },
    }, wf, logger());
}

export function createUnittestConfiguration(folder: string): IWorkspaceConfiguration {
    const python = getPythonExecutable();
    const wf = findWorkspaceFolder(folder)!;
    return new PlaceholderAwareWorkspaceConfiguration({
        pythonPath(): string {
            return python;
        },
        getCwd(): string {
            return wf.uri.fsPath;
        },
        envFile(): string {
            return path.join(wf.uri.fsPath, '.env');
        },
        getUnittestConfiguration(): IUnittestConfiguration {
            return {
                isUnittestEnabled: true,
                unittestArguments: {
                    startDirectory: '.',
                    pattern: 'test_*.py',
                },
            };
        },
        getPytestConfiguration(): IPytestConfiguration {
            throw new Error();
        },
    }, wf, logger());
}

export async function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve, _) => {
        setTimeout(() => resolve(), ms);
    });
}
