import { expect } from 'chai';
import 'mocha';
import * as vscode from 'vscode';
import { ConfigurationFactory } from '../src/configurationFactory';
import { findWorkspaceFolder } from './helpers';

function createWorkspaceConfiguration(name: string) {
    const ws = findWorkspaceFolder(name)!;
    return ConfigurationFactory.get(ws);
}

suite('VSCode workspace configuration', () => {
    const defaults = vscode.workspace.getConfiguration(undefined, null);

    test('should return default values on empty configuration', () => {
        const configuration = createWorkspaceConfiguration('empty_configuration');
        expect(configuration.getUnittestConfiguration().isUnittestEnabled).to.be.eq(
            defaults.get<boolean>('python.unitTest.unittestEnabled', false)
        );
        expect(configuration.pythonPath()).to.be.eq(
            defaults.get<string>('python.pythonPath', 'python')
        );
        expect(configuration.getCwd()).to.be.eq(
            defaults.get<string>('python.unitTest.cwd') || findWorkspaceFolder('empty_configuration')!.uri.fsPath
        );
    });

    test('should return values from python extension configuration (unittest)', () => {
        const configuration = createWorkspaceConfiguration('python_extension_configured_unittest');
        expect(configuration.getUnittestConfiguration().isUnittestEnabled).to.be.true;
        expect(configuration.pythonPath()).to.be.eq('/some/path/to/python');
        expect(configuration.getCwd()).to.be.eq('/some/unittest/cwd');
    });

    test('should return values from python extension configuration (pytest)', () => {
        const configuration = createWorkspaceConfiguration('python_extension_configured_pytest');
        expect(configuration.getPytestConfiguration().isPytestEnabled).to.be.true;
        expect(configuration.pythonPath()).to.be.eq('/some/path/to/python');
        expect(configuration.getCwd()).to.be.eq('/some/unittest/cwd');
    });

    test('should return values from python extension configuration with resolved placeholders', () => {
        process.env.SOME_PATH_USED_IN_CWD = '/some/prefix';
        expect(Object.keys(process.env)).to.include('SOME_PATH_USED_IN_CWD');

        const configuration = createWorkspaceConfiguration('python_extension_configured_with_placeholders');
        expect(configuration.getPytestConfiguration().isPytestEnabled).to.be.true;

        const path = findWorkspaceFolder('python_extension_configured_with_placeholders')!.uri.fsPath;
        expect(configuration.pythonPath()).to.be.eq(`${path}/some/path/to/python`);
        expect(configuration.getCwd()).to.be.eq('/some/prefix/some/unittest/cwd');
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
