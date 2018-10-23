import * as vscode from 'vscode';
import { TestExplorerExtension, testExplorerExtensionId } from 'vscode-test-adapter-api';

import { nextId } from './idGenerator';
import { PytestTestRunner } from './pytestTestRunner';
import { PythonTestAdapter } from './pythonTestAdapter';
import { UnittestTestRunner } from './unittestTestRunner';

function registerTestAdapters(wf: vscode.WorkspaceFolder, extension: vscode.Extension<TestExplorerExtension>) {
    const adapters = [
        () => new UnittestTestRunner(nextId()),
        () => new PytestTestRunner(nextId())
    ].map(rf => new PythonTestAdapter(wf, rf()));
    adapters.forEach(adapter => extension.exports.registerAdapter(adapter));
    return adapters;
}

export async function activate() {
    const testExplorerExtension = vscode.extensions.getExtension<TestExplorerExtension>(testExplorerExtensionId);

    if (testExplorerExtension) {
        if (!testExplorerExtension.isActive) {
            await testExplorerExtension.activate();
        }
        const registeredAdapters = new Map<vscode.WorkspaceFolder, PythonTestAdapter[]>();
        if (vscode.workspace.workspaceFolders) {
            for (const workspaceFolder of vscode.workspace.workspaceFolders) {
                const adapters = registerTestAdapters(workspaceFolder, testExplorerExtension);
                registeredAdapters.set(workspaceFolder, adapters);
            }
        }

        vscode.workspace.onDidChangeWorkspaceFolders(event => {
            for (const workspaceFolder of event.removed) {
                const adapters = registeredAdapters.get(workspaceFolder);
                if (adapters) {
                    adapters.forEach(adapter => testExplorerExtension.exports.unregisterAdapter(adapter));
                    registeredAdapters.delete(workspaceFolder);
                }
            }

            for (const workspaceFolder of event.added) {
                const adapters = registerTestAdapters(workspaceFolder, testExplorerExtension);
                registeredAdapters.set(workspaceFolder, adapters);
            }
        });
    }
}
