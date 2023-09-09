import { expect } from 'chai';
import 'mocha';
import * as vscode from 'vscode';
import { VscodeWorkspaceConfiguration } from '../../src/configuration/vscodeWorkspaceConfiguration';
import { findWorkspaceFolder } from '../utils/helpers';

function createWorkspaceConfiguration(name: string) {
    const ws = findWorkspaceFolder(name)!;
    return new VscodeWorkspaceConfiguration(ws);
}

suite('VSCode workspace configuration', () => {
    const defaults = vscode.workspace.getConfiguration(undefined, null);

    test('should return default values on empty configuration', () => {
        const configuration = createWorkspaceConfiguration('empty_configuration');
        expect(configuration.getUnittestConfiguration().isUnittestEnabled).to.be.eq(
            defaults.get<boolean>('python.unitTest.unittestEnabled', false)
        );
        expect(configuration.pythonPath()).to.be.eq(defaults.get<string>('python.pythonPath', 'python'));
        expect(configuration.getCwd()).to.be.eq(
            defaults.get<string>('python.unitTest.cwd') || findWorkspaceFolder('empty_configuration')!.uri.fsPath
        );
    });

    test('should return values from python extension configuration (unittest)', () => {
        const configuration = createWorkspaceConfiguration('python_extension_configured_unittest');
        expect(configuration.getUnittestConfiguration().isUnittestEnabled).to.be.true;
        expect(configuration.pythonPath()).to.be.eq('python');
        expect(configuration.getCwd()).to.be.eq('/some/unittest/cwd');
    });

    test('should return values from python extension configuration (pytest)', () => {
        const configuration = createWorkspaceConfiguration('python_extension_configured_pytest');
        expect(configuration.getPytestConfiguration().isPytestEnabled).to.be.true;
        expect(configuration.pythonPath()).to.be.eq('/some/path/to/python');
        expect(configuration.getCwd()).to.be.eq('/some/unittest/cwd');
        expect(configuration.getPytestConfiguration().pytestPath()).to.be.eq('pytest');
    });

    test('should return values from python extension configuration with resolved placeholders', () => {
        const configuration = createWorkspaceConfiguration('python_extension_configured_with_placeholders');
        expect(configuration.pythonPath()).to.be.eq('${workspaceFolder}/some/path/to/python');
        expect(configuration.getCwd()).to.be.eq('${env:SOME_PATH_USED_IN_CWD}/some/unittest/cwd');
        expect(configuration.getPytestConfiguration().pytestPath()).to.be.eq('${workspaceFolder}/pytest_runner.sh');
    });

    test('should return values overridden by python test explorer (unittest)', () => {
        const configuration = createWorkspaceConfiguration('test_framework_overridden_unittest');
        expect(configuration.getUnittestConfiguration().isUnittestEnabled).to.be.true;
        expect(configuration.getPytestConfiguration().isPytestEnabled).to.be.false;
    });

    test('should return values overridden by python test explorer (pytest)', () => {
        const configuration = createWorkspaceConfiguration('test_framework_overridden_pytest');
        expect(configuration.getUnittestConfiguration().isUnittestEnabled).to.be.false;
        expect(configuration.getPytestConfiguration().isPytestEnabled).to.be.true;
    });

    test('should return values overridden by python test explorer (pytest) and ignore default values', () => {
        const configuration = createWorkspaceConfiguration('test_framework_overridden_and_default');
        expect(configuration.getUnittestConfiguration().isUnittestEnabled).to.be.false;
        expect(configuration.getPytestConfiguration().isPytestEnabled).to.be.true;
    });
});
