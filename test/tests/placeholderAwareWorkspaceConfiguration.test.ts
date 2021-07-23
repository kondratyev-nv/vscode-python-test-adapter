import { expect } from 'chai';
import 'mocha';
import * as os from 'os';
import * as path from 'path';

import { PlaceholderAwareWorkspaceConfiguration } from '../../src/configuration/placeholderAwareWorkspaceConfiguration';
import {
    IPytestConfiguration,
    ITestplanConfiguration,
    IUnittestConfiguration,
    IWorkspaceConfiguration
} from '../../src/configuration/workspaceConfiguration';
import { findWorkspaceFolder, logger } from '../utils/helpers';

function getWorkspaceFolder() {
    return findWorkspaceFolder('empty_configuration')!;
}

function getConfiguration(configuration: IWorkspaceConfiguration) {
    const wf = getWorkspaceFolder();
    return new PlaceholderAwareWorkspaceConfiguration(configuration, wf, logger());
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
            envFile(): string {
                return '${workspaceFolder}/.env';
            },
            autoTestDiscoverOnSaveEnabled(): boolean {
                return true;
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
                    pytestPath: () => 'pytest',
                    isPytestEnabled: true,
                    pytestArguments: [],
                };
            },
            getTestplanConfiguration(): ITestplanConfiguration {
                return {
                    testplanPath: () => 'test_plan.py',
                    isTestplanEnabled: true,
                    testplanArguments: [],
                };
            },
        });

        const wfPath = getWorkspaceFolder().uri.fsPath;
        expect(configuration.pythonPath()).to.be.eq(path.resolve(wfPath, 'some', 'local', 'python'));
        expect(configuration.getCwd()).to.be.eq(path.resolve('/some', 'prefix', 'some', 'cwd', 'suffix'));
        expect(
            configuration.getUnittestConfiguration().unittestArguments.startDirectory
        ).to.be.eq(wfPath);
    });

    test('should resolve values from configuration without placeholders', () => {
        process.env.SOME_RELATIVE_PATH_USED_IN_CWD = '../some/prefix';
        process.env.RELATIVE_PYTEST_LOG_PATH = 'some/path/to/log';
        expect(Object.keys(process.env)).to.include('SOME_RELATIVE_PATH_USED_IN_CWD');

        const configuration = getConfiguration({
            pythonPath(): string {
                return 'python';
            },
            getCwd(): string {
                return '${env:SOME_RELATIVE_PATH_USED_IN_CWD}/some/cwd/suffix';
            },
            envFile(): string {
                return '${workspaceFolder}/.env';
            },
            autoTestDiscoverOnSaveEnabled(): boolean {
                return true;
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
                    pytestPath: () => 'pytest',
                    isPytestEnabled: true,
                    pytestArguments: [
                        '--result-log=${workspaceFolder}/${env:RELATIVE_PYTEST_LOG_PATH}'
                    ],
                };
            },
            getTestplanConfiguration(): ITestplanConfiguration {
                return {
                    testplanPath: () => 'test_plan.py',
                    isTestplanEnabled: true,
                    testplanArguments: [],
                };
            },
        });

        const wfPath = getWorkspaceFolder().uri.fsPath;
        expect(configuration.pythonPath()).to.be.eq('python');
        expect(configuration.getCwd()).to.be.eq(path.resolve(wfPath, '..', 'some', 'prefix', 'some', 'cwd', 'suffix'));
        expect(
            configuration.getUnittestConfiguration().unittestArguments.startDirectory
        ).to.be.eq(wfPath);
        expect(
            configuration.getPytestConfiguration().pytestArguments
        ).to.have.members([`--result-log=${wfPath + '/some/path/to/log'}`]);
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
            envFile(): string {
                return '${workspaceFolder}/.env';
            },
            autoTestDiscoverOnSaveEnabled(): boolean {
                return true;
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
                    pytestPath: () => 'pytest',
                    isPytestEnabled: true,
                    pytestArguments: [],
                };
            },
            getTestplanConfiguration(): ITestplanConfiguration {
                return {
                    testplanPath: () => 'test_plan.py',
                    isTestplanEnabled: true,
                    testplanArguments: [],
                };
            },
        });

        const wfPath = getWorkspaceFolder().uri.fsPath;
        expect(configuration.pythonPath()).to.be.eq('python');
        expect(configuration.getCwd()).to.be.eq(path.normalize(path.resolve(wfPath, 'some', 'cwd', 'suffix')));
    });

    test('should resolve relative path from configuration', () => {
        const configuration = getConfiguration({
            pythonPath(): string {
                return 'python';
            },
            getCwd(): string {
                return 'some_cwd';
            },
            envFile(): string {
                return '~/.env';
            },
            autoTestDiscoverOnSaveEnabled(): boolean {
                return true;
            },
            getUnittestConfiguration(): IUnittestConfiguration {
                return {
                    isUnittestEnabled: true,
                    unittestArguments: {
                        startDirectory: 'test',
                        pattern: 'test_*.py',
                    },
                };
            },
            getPytestConfiguration(): IPytestConfiguration {
                return {
                    pytestPath: () => 'pytest',
                    isPytestEnabled: true,
                    pytestArguments: [],
                };
            },
            getTestplanConfiguration(): ITestplanConfiguration {
                return {
                    testplanPath: () => 'test_plan.py',
                    isTestplanEnabled: true,
                    testplanArguments: [],
                };
            },
        });

        const wfPath = getWorkspaceFolder().uri.fsPath;
        expect(configuration.pythonPath()).to.be.eq('python');
        expect(configuration.getCwd()).to.be.eq(path.normalize(path.resolve(wfPath, 'some_cwd')));
        expect(
            configuration.getUnittestConfiguration().unittestArguments.startDirectory
        ).to.be.eq(path.normalize(path.resolve(wfPath, 'test')));
    });

    test('should resolve home path from configuration', () => {
        process.env.SOME_RELATIVE_PATH_USED_IN_CWD = '../suffix';
        expect(Object.keys(process.env)).to.include('SOME_RELATIVE_PATH_USED_IN_CWD');

        const configuration = getConfiguration({
            pythonPath(): string {
                return 'python';
            },
            getCwd(): string {
                return '~/some/cwd/prefix/${env:SOME_RELATIVE_PATH_USED_IN_CWD}';
            },
            envFile(): string {
                return '~/.env';
            },
            autoTestDiscoverOnSaveEnabled(): boolean {
                return true;
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
                    pytestPath: () => 'pytest',
                    isPytestEnabled: true,
                    pytestArguments: [],
                };
            },
            getTestplanConfiguration(): ITestplanConfiguration {
                return {
                    testplanPath: () => 'test_plan.py',
                    isTestplanEnabled: true,
                    testplanArguments: [],
                };
            },
        });

        const homePath = os.homedir();
        expect(configuration.pythonPath()).to.be.eq('python');
        expect(configuration.getCwd()).to.be.eq(path.normalize(path.resolve(homePath, 'some', 'cwd', 'suffix')));
    });

    [
        ['${workspaceFolder}', getWorkspaceFolder().uri.fsPath],
        ['${workspaceRoot}', getWorkspaceFolder().uri.fsPath],
        ['${cwd}', getWorkspaceFolder().uri.fsPath]
    ].forEach(([placeholder, expectedPath]) => {
        test(`should resolve placeholder ${placeholder} from configuration`, () => {
            const configuration = getConfiguration({
                pythonPath(): string {
                    return `${placeholder}/some/local/python`;
                },
                getCwd(): string {
                    return '';
                },
                envFile(): string {
                    return '${workspaceFolder}/.env';
                },
                autoTestDiscoverOnSaveEnabled(): boolean {
                    return true;
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
                        pytestPath: () => 'pytest',
                        isPytestEnabled: true,
                        pytestArguments: [],
                    };
                },
                getTestplanConfiguration(): ITestplanConfiguration {
                    return {
                        testplanPath: () => 'test_plan.py',
                        isTestplanEnabled: true,
                        testplanArguments: [],
                    };
                },
            });

            expect(configuration.pythonPath()).to.be.eq(path.resolve(expectedPath, 'some', 'local', 'python'));
        });
    });

    [
        ['${workspaceFolderBasename}', getWorkspaceFolder().name],
        ['${workspaceRootFolderName}', getWorkspaceFolder().name]
    ].forEach(([placeholder, expectedPath]) => {
        test(`should resolve placeholder ${placeholder} from configuration`, () => {
            const configuration = getConfiguration({
                pythonPath(): string {
                    return `/some/prefix/${placeholder}/some/local/python`;
                },
                getCwd(): string {
                    return '';
                },
                envFile(): string {
                    return '${workspaceFolder}/.env';
                },
                autoTestDiscoverOnSaveEnabled(): boolean {
                    return true;
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
                        pytestPath: () => 'pytest',
                        isPytestEnabled: true,
                        pytestArguments: [],
                    };
                },
                getTestplanConfiguration(): ITestplanConfiguration {
                    return {
                        testplanPath: () => 'test_plan.py',
                        isTestplanEnabled: true,
                        testplanArguments: [],
                    };
                },
            });

            expect(configuration.pythonPath()).to.be.eq(
                path.normalize(path.resolve('/some', 'prefix' , expectedPath, 'some', 'local', 'python'))
            );
        });
    });
});
