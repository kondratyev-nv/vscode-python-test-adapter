import { expect } from 'chai';
import 'mocha';

import { IWorkspaceConfiguration } from '../../src/configuration/workspaceConfiguration';
import { TestplanTestRunner } from '../../src/testplan/testplanTestRunner';
import {
    createTestplanConfiguration,
    expectLabelsAreSameRecursive,
    extractAllIds,
    extractExpectedState,
    findTestSuiteByLabel,
    logger,
} from '../utils/helpers';
import { TestOutputCollector, isTestplanPrerequisiteMet } from './utilities';

isTestplanPrerequisiteMet().then((isTestplan) => {
    if (!isTestplan) {
        return;
    }
    [true, false].forEach((useLegacyTestDiscovery) => {
        const postfix = useLegacyTestDiscovery ? ' (With legacy discovery)' : '';
        suite(`Testplan test discovery${postfix}`, async () => {
            const config: IWorkspaceConfiguration = createTestplanConfiguration('testplan', useLegacyTestDiscovery);
            const runner = new TestplanTestRunner('some-id', logger());

            test('should set runner id on initialization', () => {
                expect(runner).to.be.not.null;
                expect(runner.adapterId).to.be.equal('some-id');
            });

            test('should not return root suite when there is no tests', async () => {
                const configForEmptySuiteCollection: IWorkspaceConfiguration = createTestplanConfiguration(
                    'python_extension_configured_testplan',
                    useLegacyTestDiscovery
                );
                expect(runner).to.be.not.null;
                const mainSuite = await runner.load(configForEmptySuiteCollection);
                expect(mainSuite).to.be.undefined;
            });

            test('should discover any tests', async () => {
                const mainSuite = await runner.load(config);
                expect(mainSuite).to.be.not.undefined;
                expect(mainSuite!.label).to.be.eq('Testplan tests');
                expect(mainSuite!.children).to.be.not.empty;
            }).timeout(60000);

            test('should discover tests', async () => {
                const mainSuite = await runner.load(config);
                expect(mainSuite).to.be.not.undefined;

                const expectedHierarchy = {
                    Primary: {
                        AlphaSuite: {
                            test_equality_passed: {},
                            test_equality_failed: {},
                            test_membership_passed: {},
                            test_membership_failed: {},
                            test_regex_passed: {},
                            test_regex_failed: {},
                        },
                    },
                    Secondary: {
                        BetaSuite: {
                            testcase_one_passed: {},
                            testcase_two_passed: {},
                        },
                    },
                };
                expectLabelsAreSameRecursive(expectedHierarchy, mainSuite!);

                const ids = extractAllIds(mainSuite!);
                expect(ids).to.have.deep.members([
                    'Primary',
                    'Primary:AlphaSuite',
                    'Primary:AlphaSuite:test_equality_passed',
                    'Primary:AlphaSuite:test_equality_failed',
                    'Primary:AlphaSuite:test_membership_passed',
                    'Primary:AlphaSuite:test_membership_failed',
                    'Primary:AlphaSuite:test_regex_passed',
                    'Primary:AlphaSuite:test_regex_failed',
                    'Secondary',
                    'Secondary:BetaSuite',
                    'Secondary:BetaSuite:testcase_one_passed',
                    'Secondary:BetaSuite:testcase_two_passed',
                ]);
            });
        }).timeout(60000);

        suite(`Testplan test discovery with relative cwd folder${postfix}`, async () => {
            const config: IWorkspaceConfiguration = createTestplanConfiguration(
                'testplan',
                useLegacyTestDiscovery,
                [],
                'basic'
            );
            const runner = new TestplanTestRunner('some-id', logger());

            test('should discover tests', async () => {
                const mainSuite = await runner.load(config);
                expect(mainSuite).to.be.not.undefined;
                expectLabelsAreSameRecursive({ TestEcho: { MyTestsuite: { my_testcase: {} } } }, mainSuite!);

                const ids = extractAllIds(mainSuite!);
                expect(ids).to.have.deep.members([
                    'TestEcho',
                    'TestEcho:MyTestsuite',
                    'TestEcho:MyTestsuite:my_testcase',
                ]);
            });
        }).timeout(60000);

        suite(`Run testplan tests${postfix}`, () => {
            const config: IWorkspaceConfiguration = createTestplanConfiguration('testplan', useLegacyTestDiscovery);
            const runner = new TestplanTestRunner('some-id', logger());

            test('should run all tests', async () => {
                const mainSuite = await runner.load(config);
                expect(mainSuite).to.be.not.undefined;
                expect(mainSuite!.label).to.be.eq('Testplan tests');
                const collector = new TestOutputCollector();
                const states = await runner.run(config, runner.adapterId, collector);
                expect(states).to.be.not.empty;
                states.forEach((state) => {
                    const expectedState = extractExpectedState(state.test as string);
                    expect(state.state).to.be.eq(expectedState);
                });
                expect(collector.output).length.to.not.eq(0);
            });

            [
                {
                    suite: { label: 'AlphaSuite', description: undefined },
                    cases: [
                        { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_equality_passed' },
                        { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_equality_failed' },
                        { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_membership_passed' },
                        { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_membership_failed' },
                        { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_regex_passed' },
                        { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_regex_failed' },
                    ],
                },
                {
                    suite: {
                        label: 'BetaSuite',
                        description: useLegacyTestDiscovery ? undefined : 'This is the Beta Suite suite',
                    },
                    cases: [
                        { file: 'test/test_plan.py', case: 'Secondary:BetaSuite:testcase_one_passed' },
                        { file: 'test/test_plan.py', case: 'Secondary:BetaSuite:testcase_two_passed' },
                    ],
                },
            ].forEach(({ suite, cases }) => {
                test(`should run ${suite.label} suite`, async () => {
                    const mainSuite = await runner.load(config);
                    expect(mainSuite).to.be.not.undefined;
                    const suiteToRun = findTestSuiteByLabel(mainSuite!, suite.label, suite.description);
                    expect(suiteToRun).to.be.not.undefined;
                    const states = await runner.run(config, suiteToRun!.id);
                    expect(states).to.be.not.empty;
                    expect(states.map((s) => s.test)).to.have.deep.members(cases.map((c) => c.case));
                    states.forEach((state) => {
                        const expectedState = extractExpectedState(state.test as string);
                        expect(state.state).to.be.eq(expectedState);
                    });
                }).timeout(60000);
            });
        }).timeout(60000);
    });
});
