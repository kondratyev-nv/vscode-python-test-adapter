import * as vscode from 'vscode';
import { testExplorerExtensionId, TestHub } from 'vscode-test-adapter-api';

import { DefaultConfigurationFactory } from './configuration/configurationFactory';
import { nextId } from './idGenerator';
import { DefaultLogger } from './logging/defaultLogger';
import { ILogger } from './logging/logger';
import { NoopOutputChannel } from './logging/outputChannels/noopOutputChannel';
import { VscodeOutputChannel } from './logging/outputChannels/vscodeOutputChannel';
import { PytestTestRunner } from './pytest/pytestTestRunner';
import { TestplanTestRunner } from './testplan/testplanTestRunner';
import { PythonTestAdapter } from './pythonTestAdapter';
import { UnittestTestRunner } from './unittest/unittestTestRunner';
import { ITestRunner } from './testRunner';

type LoggerFactory = (framework: string, wf: vscode.WorkspaceFolder) => ILogger;
type TestRunnerClass = new (adapterId: string, logger: ILogger) => ITestRunner;

function registerTestAdapters(
    wf: vscode.WorkspaceFolder,
    extension: vscode.Extension<TestHub>,
    loggerFactory: LoggerFactory
) {
    const adapters = [
        createPythonTestAdapter('unittest', UnittestTestRunner, wf, loggerFactory),
        createPythonTestAdapter('pytest', PytestTestRunner, wf, loggerFactory),
        createPythonTestAdapter('testplan', TestplanTestRunner, wf, loggerFactory),
    ];
    adapters.forEach((adapter) => extension.exports.registerTestAdapter(adapter));
    return adapters;
}

function configureLogging(context: vscode.ExtensionContext): LoggerFactory {
    try {
        const channel = vscode.window.createOutputChannel('Python Test Adapter Log');
        context.subscriptions.push(channel);
        return (framework, wf) => {
            return new DefaultLogger(new VscodeOutputChannel(channel), wf, framework);
        };
    } catch {
        return (framework, wf) => {
            return new DefaultLogger(new NoopOutputChannel(), wf, framework);
        };
    }
}

export async function activate(context: vscode.ExtensionContext) {
    const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);
    if (!testExplorerExtension) {
        return;
    }

    if (!testExplorerExtension.isActive) {
        await testExplorerExtension.activate();
    }

    const loggerFactory = configureLogging(context);
    const registeredAdapters = new Map<vscode.WorkspaceFolder, PythonTestAdapter[]>();
    if (vscode.workspace.workspaceFolders) {
        for (const workspaceFolder of vscode.workspace.workspaceFolders) {
            const adapters = registerTestAdapters(workspaceFolder, testExplorerExtension, loggerFactory);
            registeredAdapters.set(workspaceFolder, adapters);
        }
    }

    const workspaceFolderChangedSubscription = vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const workspaceFolder of event.removed) {
            const adapters = registeredAdapters.get(workspaceFolder);
            if (adapters) {
                adapters.forEach((adapter) => {
                    testExplorerExtension.exports.unregisterTestAdapter(adapter);
                    adapter.dispose();
                });
                registeredAdapters.delete(workspaceFolder);
            }
        }

        for (const workspaceFolder of event.added) {
            const adapters = registerTestAdapters(workspaceFolder, testExplorerExtension, loggerFactory);
            registeredAdapters.set(workspaceFolder, adapters);
        }
    });
    context.subscriptions.push(workspaceFolderChangedSubscription);
}

function createPythonTestAdapter(
    frameworkName: string,
    runnerClass: TestRunnerClass,
    wf: vscode.WorkspaceFolder,
    loggerFactory: LoggerFactory
) {
    const logger = loggerFactory(frameworkName, wf);
    const runner = new runnerClass(nextId(), logger);
    const configurationFactory = new DefaultConfigurationFactory(logger);

    return new PythonTestAdapter(frameworkName, wf, runner, configurationFactory, logger);
}
