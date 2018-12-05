import * as vscode from 'vscode';
import { testExplorerExtensionId, TestHub } from 'vscode-test-adapter-api';

import { nextId } from './idGenerator';
import { DefaultLogger } from './logging/defaultLogger';
import { ILogger } from './logging/logger';
import { NoopOutputChannel } from './logging/outputChannels/noopOutputChannel';
import { VscodeOutputChannel } from './logging/outputChannels/vscodeOutputChannel';
import { PytestTestRunner } from './pytestTestRunner';
import { PythonTestAdapter } from './pythonTestAdapter';
import { UnittestTestRunner } from './unittestTestRunner';

function registerTestAdapters(
    wf: vscode.WorkspaceFolder,
    extension: vscode.Extension<TestHub>,
    loggerFactory: (wf: vscode.WorkspaceFolder) => ILogger
) {
    const adapters = [
        () => new UnittestTestRunner(nextId(), loggerFactory(wf)),
        () => new PytestTestRunner(nextId(), loggerFactory(wf))
    ].map(rf => new PythonTestAdapter(wf, rf(), loggerFactory(wf)));
    adapters.forEach(adapter => extension.exports.registerTestAdapter(adapter));
    return adapters;
}

function configureLogging(context: vscode.ExtensionContext): (wf: vscode.WorkspaceFolder) => ILogger {
    try {
        const channel = vscode.window.createOutputChannel('Python Test Adapter Log');
        context.subscriptions.push(channel);
        return wf => new DefaultLogger(new VscodeOutputChannel(channel), wf);
    } catch {
        return wf => new DefaultLogger(new NoopOutputChannel(), wf);
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

    const workspaceFolderChangedSubscription = vscode.workspace.onDidChangeWorkspaceFolders(event => {
        for (const workspaceFolder of event.removed) {
            const adapters = registeredAdapters.get(workspaceFolder);
            if (adapters) {
                adapters.forEach(adapter => {
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
