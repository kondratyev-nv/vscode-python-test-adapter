import { expect } from 'chai';
import 'mocha';
import * as path from 'path';

import { PlaceholderAwareWorkspaceConfiguration } from '../src/placeholderAwareWorkspaceConfiguration';
import { IPytestConfiguration, IUnittestConfiguration, IWorkspaceConfiguration } from '../src/workspaceConfiguration';
import { findWorkspaceFolder } from './helpers';

function getWorkspaceFolder() {
    return findWorkspaceFolder('empty_configuration')!;
}

function getConfiguration(configuration: IWorkspaceConfiguration) {
    const wf = getWorkspaceFolder();
    return new PlaceholderAwareWorkspaceConfiguration(configuration, wf);
}

suite('Placeholder aware workspace configuration', () => {
    test('should resolve values from configuration with resolved placeholders', () => {
        process.env.SOME_PATH_USED_IN_CWD = '/some/prefix';
        expect(Object.keys(process.env)).to.include('SOME_PATH_USED_IN_CWD');

        const configuration = getConfiguration({
            pythonPath(): string {
                return '${workspaceFolder}/some/local/python';
            },
            getCwd(): string {
                return '${env:SOME_PATH_USED_IN_CWD}/some/cwd/suffix';
            },
            getUnittestConfiguration(): IUnittestConfiguration {
                return {
                    isUnittestEnabled: true,
                    unittestArguments: {
                        startDirectory: '${workspaceFolder}/./',
                        pattern: 'test_*.py',
                    },
                };
            },
            getPytestConfiguration(): IPytestConfiguration {
                return {
                    isPytestEnabled: true,
                    pytestArguments: [],
                };
            },
        });

        const wfPath = getWorkspaceFolder().uri.fsPath;
        expect(configuration.pythonPath()).to.be.eq(path.resolve(wfPath, 'some', 'local', 'python'));
        expect(configuration.getCwd()).to.be.eq(path.resolve('/some', 'prefix', 'some', 'cwd', 'suffix'));
        expect(
            configuration.getUnittestConfiguration().unittestArguments.startDirectory
        ).to.be.eq(wfPath + '/./');
    });

    test('should resolve values from configuration without placeholders', () => {
        process.env.SOME_RELATIVE_PATH_USED_IN_CWD = '../some/prefix';
        process.env.SOME_RELATIVE_PATH_USED_IN_START_DIR = '../some/prefix';
        expect(Object.keys(process.env)).to.include('SOME_RELATIVE_PATH_USED_IN_CWD');

        const configuration = getConfiguration({
            pythonPath(): string {
                return 'python';
            },
            getCwd(): string {
                return '${env:SOME_RELATIVE_PATH_USED_IN_CWD}/some/cwd/suffix';
            },
            getUnittestConfiguration(): IUnittestConfiguration {
                return {
                    isUnittestEnabled: true,
                    unittestArguments: {
                        startDirectory: './',
                        pattern: 'test_*.py',
                    },
                };
            },
            getPytestConfiguration(): IPytestConfiguration {
                return {
                    isPytestEnabled: true,
                    pytestArguments: [],
                };
            },
        });

        const wfPath = getWorkspaceFolder().uri.fsPath;
        expect(configuration.pythonPath()).to.be.eq('python');
        expect(configuration.getCwd()).to.be.eq(path.resolve(wfPath, '..', 'some', 'prefix', 'some', 'cwd', 'suffix'));
        expect(
            configuration.getUnittestConfiguration().unittestArguments.startDirectory
        ).to.be.eq('./');
    });

    test('should resolve relative path placeholders from configuration', () => {
        process.env.SOME_RELATIVE_PATH_USED_IN_CWD = '../suffix';
        expect(Object.keys(process.env)).to.include('SOME_RELATIVE_PATH_USED_IN_CWD');

        const configuration = getConfiguration({
            pythonPath(): string {
                return 'python';
            },
            getCwd(): string {
                return './some/cwd/prefix/${env:SOME_RELATIVE_PATH_USED_IN_CWD}';
            },
            getUnittestConfiguration(): IUnittestConfiguration {
                return {
                    isUnittestEnabled: true,
                    unittestArguments: {
                        startDirectory: './',
                        pattern: 'test_*.py',
                    },
                };
            },
            getPytestConfiguration(): IPytestConfiguration {
                return {
                    isPytestEnabled: true,
                    pytestArguments: [],
                };
            },
        });

        const wfPath = getWorkspaceFolder().uri.fsPath;
        expect(configuration.pythonPath()).to.be.eq('python');
        expect(configuration.getCwd()).to.be.eq(path.normalize(path.resolve(wfPath, 'some', 'cwd', 'suffix')));
    });
});
