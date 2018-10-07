import { expect } from 'chai';
import 'mocha';
import * as vscode from 'vscode';
import { VscodeWorkspaceConfiguration } from '../src/vscodeWorkspaceConfiguration';
import { findWorkspaceFolder } from './helpers';

function createWorkspaceConfiguration(name: string) {
    const ws = findWorkspaceFolder(name)!;
    return new VscodeWorkspaceConfiguration(ws);
}

suite('VSCode workspace configuration', () => {
    const defaults = vscode.workspace.getConfiguration(undefined, null);

    test('should return default values on empty configuration', () => {
        const configuration = createWorkspaceConfiguration('empty_configuration');
        expect(configuration.isUnitTestEnabled()).to.be.eq(
            defaults.get<boolean>('python.unitTest.unittestEnabled', false)
        );
        expect(configuration.pythonPath()).to.be.eq(
            defaults.get<string>('python.pythonPath', 'python')
        );
        expect(configuration.getCwd()).to.be.eq(
            defaults.get<string>('python.unitTest.cwd') || configuration.workspaceFolder.uri.fsPath
        );
    });

    test.skip('should return values from python extension configuration', () => {
        const configuration = createWorkspaceConfiguration('python_extension_configured');
        expect(configuration.isUnitTestEnabled()).to.be.true;
        expect(configuration.pythonPath()).to.be.eq('/some/path/to/python');
        expect(configuration.getCwd()).to.be.eq('/some/unittest/cwd');
    });

    test('should return values overridden by python test explorer', () => {
        const configuration = createWorkspaceConfiguration('test_framework_overridden');
        expect(configuration.isUnitTestEnabled()).to.be.true;
    });
});
