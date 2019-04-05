import { expect } from 'chai';
import 'mocha';
import * as vscode from 'vscode';

import { IWorkspaceConfiguration } from '../src/configuration/workspaceConfiguration';
import { UnittestTestRunner } from '../src/unittest/unittestTestRunner';
import { createUnittestConfiguration, extractExpectedState, findTestSuiteByLabel, logger } from './helpers';

suite('Unittest test discovery', () => {
    const config: IWorkspaceConfiguration = createUnittestConfiguration('python', 'unittest');
    const runner = new UnittestTestRunner('some-id', logger());

    test('should set runner id on initialization', () => {
        expect(runner).to.be.not.null;
        expect(runner.adapterId).to.be.equal('some-id');
    });

    test('should not return root suite when there is no tests', async () => {
        const configForEmptySuiteCollection: IWorkspaceConfiguration = createUnittestConfiguration(
            'python', 'python_extension_configured_unittest'
        );
        const suites = await runner.load(configForEmptySuiteCollection);
        expect(suites).to.be.undefined;
    });

    test('should discover any tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(mainSuite!.label).to.be.eq('Unittest tests');
        expect(mainSuite!.children).to.be.not.empty;
    });

    test('should discover tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        const expectedSuites = [
            'TestWithOutputBeforeImport',
            'TestWithSetUpClassMethod',
            'AddTests',
            'AddTests',
            'TestWithTearDownClassMethod',
            'EnvironmentVariablesTests'
        ];
        const labels = mainSuite!.children.map(x => x.label);
        expect(labels).to.have.members(expectedSuites);
    });
});

suite('Run unittest tests', () => {
    const config: IWorkspaceConfiguration = createUnittestConfiguration('python', 'unittest');
    const runner = new UnittestTestRunner('some-id', logger());

    test('should run all tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(mainSuite!.label).to.be.eq('Unittest tests');
        const states = await runner.run(config, mainSuite!.id);
        expect(states).to.be.not.empty;
        states.forEach(state => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });

    [
        { testCase: 'TestWithOutputBeforeImport' },
        { testCase: 'TestWithSetUpClassMethod' },
        { testCase: 'AddTests', description: 'basic_tests.test_add' }
    ].forEach(({ testCase, description }) => {
        test(`should run ${testCase} suite`, async () => {
            const mainSuite = await runner.load(config);
            expect(mainSuite).to.be.not.undefined;
            const suite = findTestSuiteByLabel(mainSuite!, testCase, description);
            expect(suite).to.be.not.undefined;
            const states = await runner.run(config, suite!.id);
            expect(states).to.be.not.empty;
            states.forEach(state => {
                const expectedState = extractExpectedState(state.test as string);
                expect(state.state).to.be.eq(expectedState);
            });
        });
    });

    [
        'test_basic_two_plus_one_is_three_passed',
        'test_basic_two_plus_two_is_five_failed',
        'test_basic_two_plus_zero_is_two_skipped',
        'test_set_up_called_before_test_case1_passed',
        'test_set_up_called_before_test_case2_passed'
    ].forEach(testMethod => {
        test(`should run ${testMethod} test`, async () => {
            const mainSuite = await runner.load(config);
            expect(mainSuite).to.be.not.undefined;
            const suite = findTestSuiteByLabel(mainSuite!, testMethod);
            expect(suite).to.be.not.undefined;
            const states = await runner.run(config, suite!.id);
            expect(states).to.be.not.empty;
            states.forEach(state => {
                const expectedState = extractExpectedState(state.test as string);
                expect(state.state).to.be.eq(expectedState);
            });
        });
    });

    [
        'test_basic_two_plus_one_is_three_passed',
        'test_basic_two_plus_two_is_five_failed'
    ].forEach(testMethod => {
        test(`should capture output from ${testMethod} test`, async () => {
            const mainSuite = await runner.load(config);
            expect(mainSuite).to.be.not.undefined;
            const suite = findTestSuiteByLabel(mainSuite!, testMethod);
            expect(suite).to.be.not.undefined;
            const states = await runner.run(config, suite!.id);
            expect(states).to.be.not.empty;
            states.forEach(state => {
                const expectedState = extractExpectedState(state.test as string);
                expect(state.state).to.be.eq(expectedState);
                expect(state.message).to.be.not.empty;
                const firstOutput = state.message!.indexOf(`${testMethod}: checking 2 +`);
                const lastOutput = state.message!.lastIndexOf(`${testMethod}: checking 2 +`);
                expect(firstOutput).to.be.gte(0);
                expect(lastOutput).to.be.gte(0);
                expect(firstOutput).to.be.eq(lastOutput);
            });
        });
    });
});

suite('Unittest run and discovery with start folder in config', () => {
    const config = {
        pythonPath(): string {
            return 'python';
        },
        getCwd(): string {
            const folders = vscode.workspace.workspaceFolders!
                .filter(f => f.name === 'unittest');
            return folders[0].uri.fsPath;
        },
        envFile(): string {
            return '${workspaceFolder}/.env';
        },
        getUnittestConfiguration() {
            return {
                isUnittestEnabled: true,
                unittestArguments: {
                    startDirectory: './unittest_without_init',
                    pattern: 'test_*.py',
                },
            };
        },
        getPytestConfiguration() {
            throw new Error('Pytest is not available');
        },
    };
    const runner = new UnittestTestRunner('some-id', logger());

    test('should discover tests with start folder in config', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        const expectedSuites = [
            'AddTestsWithoutInit'
        ];
        const labels = mainSuite!.children.map(x => x.label);
        expect(labels).to.have.members(expectedSuites);
    });

    test('should run all tests with start folder in config', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(mainSuite!.label).to.be.eq('Unittest tests');
        const states = await runner.run(config, mainSuite!.id);
        expect(states).to.be.not.empty;
        states.forEach(state => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });

    test('should run suite with start folder in config', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        const suite = findTestSuiteByLabel(mainSuite!, 'AddTestsWithoutInit');
        expect(suite).to.be.not.undefined;
        const states = await runner.run(config, suite!.id);
        expect(states).to.be.not.empty;
        states.forEach(state => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });

    test('should run test from suite with start folder in config', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        const suite = findTestSuiteByLabel(mainSuite!, 'test_two_plus_one_is_three_passed');
        expect(suite).to.be.not.undefined;
        const states = await runner.run(config, suite!.id);
        expect(states).to.be.not.empty;
        states.forEach(state => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });
});
