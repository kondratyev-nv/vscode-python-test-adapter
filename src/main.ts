import * as vscode from 'vscode';
import { TestExplorerExtension, testExplorerExtensionId } from 'vscode-test-adapter-api';
import { UnittestTestAdapter } from './unittestTestAdapter';

export async function activate(context: vscode.ExtensionContext) {

    const testExplorerExtension = vscode.extensions.getExtension<TestExplorerExtension>(testExplorerExtensionId);

    if (testExplorerExtension) {

        if (!testExplorerExtension.isActive) {
            await testExplorerExtension.activate();
        }

        const registeredAdapters = new Map<vscode.WorkspaceFolder, UnittestTestAdapter>();

        if (vscode.workspace.workspaceFolders) {
            for (const workspaceFolder of vscode.workspace.workspaceFolders) {
                const adapter = new UnittestTestAdapter(workspaceFolder);
                registeredAdapters.set(workspaceFolder, adapter);
                testExplorerExtension.exports.registerAdapter(adapter);
            }
        }

        vscode.workspace.onDidChangeWorkspaceFolders((event) => {

            for (const workspaceFolder of event.removed) {
                const adapter = registeredAdapters.get(workspaceFolder);
                if (adapter) {
                    testExplorerExtension.exports.unregisterAdapter(adapter);
                    registeredAdapters.delete(workspaceFolder);
                }
            }

            for (const workspaceFolder of event.added) {
                const adapter = new UnittestTestAdapter(workspaceFolder);
                registeredAdapters.set(workspaceFolder, adapter);
                testExplorerExtension.exports.registerAdapter(adapter);
            }
        });
    }
}
