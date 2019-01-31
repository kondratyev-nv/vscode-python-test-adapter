import { expect } from 'chai';
import 'mocha';
import * as vscode from 'vscode';
import { TestEvent, TestLoadFinishedEvent, TestSuiteInfo } from 'vscode-test-adapter-api';

import { IConfigurationFactory } from '../src/configuration/configurationFactory';
import { IWorkspaceConfiguration } from '../src/configuration/workspaceConfiguration';
import { PytestTestRunner } from '../src/pytest/pytestTestRunner';
import { PythonTestAdapter } from '../src/pythonTestAdapter';
import { UnittestTestRunner } from '../src/unittest/unittestTestRunner';
import {
    createPytestConfiguration,
    createUnittestConfiguration,
    extractExpectedState,
    findTestSuiteByLabel,
    findWorkspaceFolder,
    logger
} from './helpers';

[
    {
        label: 'unittest',
        runner: new UnittestTestRunner('first-id', logger()),
        configuration: createUnittestConfiguration('python', 'unittest'),
        testsToRun: [
            'test_basic_two_plus_one_is_three_passed',
            'test_basic_two_plus_two_is_five_failed',
            'test_basic_two_plus_zero_is_two_skipped'
        ],
        suiteToSort: {
            suite: 'AddTests (basic_tests.test_add)',
            sortedTests: [
                'test_basic_two_plus_one_is_three_passed',
                'test_basic_two_plus_two_is_five_failed',
                'test_basic_two_plus_zero_is_two_skipped'
            ],
        },
    },
    {
        label: 'pytest',
        runner: new PytestTestRunner('second-id', logger()),
        configuration: createPytestConfiguration('python', 'pytest'),
        testsToRun: [
            'test_one_plus_two_is_three_passed',
            'test_two_plus_two_is_five_failed',
            'test_capitalize_passed'
        ],
        suiteToSort: {
            suite: 'TestSampleWithScenarios',
            sortedTests: [
                'test_demo1_passed[advanced]',
                'test_demo1_passed[basic]',
                'test_demo2_passed[advanced]',
                'test_demo2_passed[basic]',
                'test_demo10_passed[advanced]',
                'test_demo10_passed[basic]'
            ],
        },
    }
].forEach(({ label, runner, configuration, testsToRun, suiteToSort }) => {
    suite(`Adapter events with ${label} runner`, () => {
        const workspaceFolder = findWorkspaceFolder(label)!;
        const configurationFactory: IConfigurationFactory = {
            get(_: vscode.WorkspaceFolder): IWorkspaceConfiguration {
                return configuration;
            },
        };

        test('discovery events should be successfully fired', async () => {
            const adapter = new PythonTestAdapter(workspaceFolder, runner, configurationFactory, logger());
            let startedNotifications = 0;
            let finishedNotifications = 0;
            let finishedEvent: TestLoadFinishedEvent | undefined;
            adapter.tests(event => {
                if (event.type === 'started') {
                    startedNotifications++;
                } else {
                    finishedNotifications++;
                    finishedEvent = event;
                }
            });
            await adapter.load();

            expect(startedNotifications).to.be.eq(1);
            expect(startedNotifications).to.be.eq(finishedNotifications);

            expect(finishedEvent!.errorMessage).to.be.undefined;
            expect(finishedEvent!.suite).to.be.not.undefined;
            expect(finishedEvent!.suite!.children).to.be.not.empty;
        });

        test(`test execution events should be successfully fired for ${label}`, async () => {
            const adapter = new PythonTestAdapter(workspaceFolder, runner, configurationFactory, logger());
            const mainSuite = await runner.load(configurationFactory.get(workspaceFolder));
            expect(mainSuite).to.be.not.undefined;
            const suites = testsToRun.map(t => findTestSuiteByLabel(mainSuite!, t)!);

            let startedNotifications = 0;
            let finishedNotifications = 0;
            const states: TestEvent[] = [];
            adapter.testStates(event => {
                if (event.type === 'started') {
                    startedNotifications++;
                } else if (event.type === 'finished') {
                    finishedNotifications++;
                } else if (event.type === 'test') {
                    states.push(event);
                } else {
                    /* */
                }
            });
            await adapter.run(suites.map(s => s.id));

            expect(startedNotifications).to.be.eq(1);
            expect(startedNotifications).to.be.eq(finishedNotifications);

            expect(states).to.be.not.empty;
            expect(states).to.have.length(testsToRun.length);
            states.forEach(state => {
                const expectedState = extractExpectedState(state.test as string);
                expect(state.state).to.be.eq(expectedState);
            });
        });

        test('discovered tests should be sorted alphabetically', async () => {
            const adapter = new PythonTestAdapter(workspaceFolder, runner, configurationFactory, logger());
            let startedNotifications = 0;
            let finishedNotifications = 0;
            let finishedEvent: TestLoadFinishedEvent | undefined;
            adapter.tests(event => {
                if (event.type === 'started') {
                    startedNotifications++;
                } else {
                    finishedNotifications++;
                    finishedEvent = event;
                }
            });
            await adapter.load();

            expect(startedNotifications).to.be.eq(1);
            expect(startedNotifications).to.be.eq(finishedNotifications);

            expect(finishedEvent!.errorMessage).to.be.undefined;
            expect(finishedEvent!.suite).to.be.not.undefined;
            expect(finishedEvent!.suite!.children).to.be.not.empty;

            const suiteToCheck = findTestSuiteByLabel(finishedEvent!.suite!, suiteToSort.suite)! as TestSuiteInfo;
            expect(suiteToCheck.type).to.be.eq('suite');
            expect(suiteToCheck.children).to.be.not.empty;
            expect(suiteToCheck.children.map(t => t.label)).to.have.ordered.members(suiteToSort.sortedTests);
        });
    });
});
