import * as path from 'path';
import * as vscode from 'vscode';

import { expect } from 'chai';

import { TestEvent, TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { PlaceholderAwareWorkspaceConfiguration } from '../src/configuration/placeholderAwareWorkspaceConfiguration';
import {
    IPytestConfiguration,
    IUnittestConfiguration,
    IWorkspaceConfiguration
} from '../src/configuration/workspaceConfiguration';
import { ILogger } from '../src/logging/logger';

export function logger(): ILogger {
    return {
        log(level: 'info' | 'warn' | 'crit', message: string): void {
            if (process.env.ENABLE_TEST_LOGGING) {
                console.log(`${level}: ${message}`);
            }
        },
    };
}

export function excectTestsStatesCorrect(states: TestEvent[]) {
    expect(states).to.be.not.empty;
    states.forEach(state => {
        const expectedState = extractExpectedState(state.test as string);
        expect(state.state).to.be.eq(expectedState);
    });
}

export function excectAllTestsCorrectlyRun(suit: TestSuiteInfo | TestInfo, states: TestEvent[]) {
    const expectedTests = linearizeTests(suit);
    expect(states).to.be.not.empty;
    expect(states.length).to.be.gte(expectedTests.length);
    expect(states.map(state => state.test)).to.have.members(expectedTests.map(t => t.id));
    excectTestsStatesCorrect(states);
}

export function extractExpectedState(name: string) {
    if (name.includes('[')) {
        name = name.split('[')[0];
    }
    return name.split('_').slice(-1)[0];
}

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
            throw new Error();
        },
        getPytestConfiguration(): IPytestConfiguration {
            return {
                isPytestEnabled: true,
                pytestArguments: [],
            };
        },
    }, wf, logger());
}

export function createUnittestConfiguration(python: string, folder: string): IWorkspaceConfiguration {
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

function linearizeTests(root: TestSuiteInfo | TestInfo): TestInfo[] {
    if (root.type === 'test') {
        return [root];
    }
    return root.children.map(t => linearizeTests(t)).reduce((r, x) => r.concat(x), []);
}
