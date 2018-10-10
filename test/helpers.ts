import * as vscode from 'vscode';


import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import {
    IPytestConfiguration,
    IUnittestConfiguration,
    IWorkspaceConfiguration
} from '../src/workspaceConfiguration';

export function findTestSuiteByLabel(
    suite: TestSuiteInfo | TestInfo,
    label: string
): TestSuiteInfo | TestInfo | undefined {

    if (suite.label === label) {
        return suite;
    }
    if (suite.type === 'test') {
        return undefined;
    }
    for (const child of suite.children) {
        const r = findTestSuiteByLabel(child, label);
        if (r !== undefined) {
            return r;
        }
    }
    return undefined;
}

export function findWorkspaceFolder(folder: string): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders!.find(f => f.name === folder);
}

export function createPytestConfiguration(python: string, folder: string): IWorkspaceConfiguration {
    return {
        pythonPath(): string {
            return python;
        },
        getCwd(): string {
            return findWorkspaceFolder(folder)!.uri.fsPath;
        },
        getUnittestConfiguration(): IUnittestConfiguration {
            throw new Error();
        },
        getPytestConfiguration(): IPytestConfiguration {
            return {
                isPytestEnabled: true,
                pytestArguments: [],
            };
        },
    };
}

export function createUnittestConfiguration(python: string, folder: string): IWorkspaceConfiguration {
    return {
        pythonPath(): string {
            return python;
        },
        getCwd(): string {
            return findWorkspaceFolder(folder)!.uri.fsPath;
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
    };
}
