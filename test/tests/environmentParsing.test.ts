import { expect } from 'chai';
import 'mocha';
import * as path from 'path';

import { IPytestConfiguration, IUnittestConfiguration } from '../../src/configuration/workspaceConfiguration';
import { PytestTestRunner } from '../../src/pytest/pytestTestRunner';
import { UnittestTestRunner } from '../../src/unittest/unittestTestRunner';
import { findWorkspaceFolder, logger } from '../utils/helpers';

[
    {
        name: 'pytest',
        runner: new PytestTestRunner('some-id', logger()),
    },
    {
        name: 'unittest',
        runner: new UnittestTestRunner('some-id', logger()),
    }
].forEach(({ name, runner }) => {
    suite(`Environment variable parsing with ${name} runner`, () => {
        test('should not fail on bad .env file', async () => {
            const wf = findWorkspaceFolder('bad_env_file')!;
            const config = {
                pythonPath(): string {
                    return 'python';
                },
                getCwd(): string {
                    return wf.uri.fsPath;
                },
                envFile(): string {
                    return path.join(wf.uri.fsPath, '.env');
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
                        isPytestEnabled: true,
                        pytestArguments: [],
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
                    return 'python';
                },
                getCwd(): string {
                    return wf.uri.fsPath;
                },
                envFile(): string {
                    return '/some/not/existent/path/.env';
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
                        isPytestEnabled: true,
                        pytestArguments: [],
                    };
                },
            };
            const suites = await runner.load(config);
            expect(suites).to.be.undefined;
        });
    });
});
