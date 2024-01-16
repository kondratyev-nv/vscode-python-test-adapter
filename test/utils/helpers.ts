import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { PlaceholderAwareWorkspaceConfiguration } from '../../src/configuration/placeholderAwareWorkspaceConfiguration';
import {
    IPytestConfiguration,
    ITestplanConfiguration,
    IUnittestConfiguration,
    IWorkspaceConfiguration,
} from '../../src/configuration/workspaceConfiguration';
import { ILogger } from '../../src/logging/logger';
import { empty } from '../../src/utilities/collections';
import { getPythonExecutable } from './testConfiguration';

interface ITreeNode {
    [key: string]: ITreeNode;
}

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
    return vscode.workspace.workspaceFolders!.find((f) => f.name === folder);
}

function getBaseConfigurationObject(folder: string, cwd?: string) {
    const python = getPythonExecutable();
    const wf = findWorkspaceFolder(folder)!;

    return <IWorkspaceConfiguration>{
        pythonPath(): string {
            return python;
        },
        getCwd(): string {
            return cwd || wf.uri.fsPath;
        },
        envFile(): string {
            return path.join(wf.uri.fsPath, '..', '.env');
        },
        collectOutputs() {
            return false;
        },
        showOutputsOnRun() {
            return false;
        },
        autoTestDiscoverOnSaveEnabled(): boolean {
            return true;
        },
        getUnittestConfiguration(): IUnittestConfiguration {
            throw new Error();
        },
        getPytestConfiguration(): IPytestConfiguration {
            throw new Error();
        },
        getTestplanConfiguration(): ITestplanConfiguration {
            throw new Error();
        },
    };
}

export function createPytestConfiguration(folder: string, args?: string[], cwd?: string): IWorkspaceConfiguration {
    const wf = findWorkspaceFolder(folder)!;
    return new PlaceholderAwareWorkspaceConfiguration(
        {
            ...getBaseConfigurationObject(folder, cwd),
            getPytestConfiguration(): IPytestConfiguration {
                return {
                    pytestPath: () => 'pytest',
                    isPytestEnabled: true,
                    pytestArguments: args || [],
                };
            },
        },
        wf,
        logger()
    );
}

export function createUnittestConfiguration(folder: string): IWorkspaceConfiguration {
    const wf = findWorkspaceFolder(folder)!;
    return new PlaceholderAwareWorkspaceConfiguration(
        {
            ...getBaseConfigurationObject(folder),
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
        },
        wf,
        logger()
    );
}

export function createTestplanConfiguration(folder: string, args?: string[], cwd?: string): IWorkspaceConfiguration {
    const wf = findWorkspaceFolder(folder)!;
    return new PlaceholderAwareWorkspaceConfiguration(
        {
            ...getBaseConfigurationObject(folder, cwd),
            getTestplanConfiguration(): ITestplanConfiguration {
                return {
                    testplanPath: () => 'test_plan.py',
                    isTestplanEnabled: true,
                    testplanUseLegacyDiscovery: true,
                    testplanArguments: args || [],
                };
            },
        },
        wf,
        logger()
    );
}

export async function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve, _) => {
        setTimeout(() => resolve(), ms);
    });
}

export function extractTopLevelLablesAndDescription(suite: TestSuiteInfo): { label: string; description?: string }[] {
    return suite.children.map((t) => {
        return { label: t.label, description: t.description };
    });
}

export function expectLabelsAreSameRecursive(expected: ITreeNode, actual: TestSuiteInfo): void {
    const expectedLabels = Object.keys(expected);
    const actualLabels = actual.children.map((t) => t.label);
    expect(actualLabels).to.have.members(expectedLabels);

    for (const [label, expectedChild] of Object.entries(expected)) {
        const actualChild = actual.children.find((t) => t.label === label);
        expect(actualChild).to.be.not.undefined;
        if (empty(Object.keys(expectedChild))) {
            expect(actualChild!.type).to.be.eq(
                'test',
                `Invalid node type for ${actualChild!.label} (${actualChild!.id}) ${Object.keys(expectedChild)}`
            );
        } else {
            expect(actualChild!.type).to.be.eq(
                'suite',
                `Invalid node type for ${actualChild!.label} (${actualChild!.id}) ${Object.keys(expectedChild)}`
            );
            expectLabelsAreSameRecursive(expectedChild, actualChild as TestSuiteInfo);
        }
    }
}

export function extractAllIds(suite: TestSuiteInfo): string[] {
    return suite.children
        .map((t) => {
            if ((t as TestSuiteInfo).children) {
                return [t.id].concat(extractAllIds(t as TestSuiteInfo));
            } else {
                return [t.id];
            }
        })
        .reduce((r, x) => r.concat(x), []);
}
