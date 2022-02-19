import { expect } from 'chai';
import 'mocha';
import * as path from 'path';

import { IBehaveConfiguration, IPytestConfiguration, ITestplanConfiguration, IUnittestConfiguration } from '../../src/configuration/workspaceConfiguration';
import { PytestTestRunner } from '../../src/pytest/pytestTestRunner';
import { TestplanTestRunner } from '../../src/testplan/testplanTestRunner';
import { UnittestTestRunner } from '../../src/unittest/unittestTestRunner';
import { findWorkspaceFolder, logger } from '../utils/helpers';
import { getPythonExecutable } from '../utils/testConfiguration';

[
    {
        name: 'pytest',
        runner: new PytestTestRunner('some-id', logger()),
    },
    {
        name: 'unittest',
        runner: new UnittestTestRunner('some-id', logger()),
    },
    {
        name: 'testplan',
        runner: new TestplanTestRunner('some-id', logger()),
    }
].forEach(({ name, runner }) => {
    suite(`Environment variable parsing with ${name} runner`, () => {
        test('should not fail on bad .env file', async () => {
            const wf = findWorkspaceFolder('bad_env_file')!;
            const config = {
                pythonPath(): string {
                    return getPythonExecutable();
                },
                getCwd(): string {
                    return wf.uri.fsPath;
                },
                envFile(): string {
                    return path.join(wf.uri.fsPath, '.env');
                },
                autoTestDiscoverOnSaveEnabled(): boolean {
                    return true;
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
                getBehaveConfiguration(): IBehaveConfiguration {
                    return {
                        behavePath: () => 'behave',
                        isBehaveEnabled: true,
                        behaveArguments: [],
                    };
                },
            };
            const suites = await runner.load(config);
            expect(suites).to.be.undefined;
        });

        test('should not fail on not existent .env file', async () => {
            const wf = findWorkspaceFolder('bad_env_file')!;
            const config = {
                pythonPath(): string {
                    return getPythonExecutable();
                },
                getCwd(): string {
                    return wf.uri.fsPath;
                },
                envFile(): string {
                    return '/some/not/existent/path/.env';
                },
                autoTestDiscoverOnSaveEnabled(): boolean {
                    return true;
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
                getBehaveConfiguration(): IBehaveConfiguration {
                    return {
                        behavePath: () => 'behave',
                        isBehaveEnabled: true,
                        behaveArguments: [],
                    };
                },
            };
            const suites = await runner.load(config);
            expect(suites).to.be.undefined;
        });
    });
});
