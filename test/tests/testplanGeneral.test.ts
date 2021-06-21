import { expect } from 'chai';
import 'mocha';

import { IWorkspaceConfiguration } from '../../src/configuration/workspaceConfiguration';
import { TestplanTestRunner } from '../../src/testplan/testplanTestRunner';
import {
    createTestplanConfiguration,
    extractAllIds,
    extractAllLabels,
    extractExpectedState,
    findTestSuiteByLabel,
    logger
} from '../utils/helpers';

suite('Testplan test discovery', async () => {
    const config: IWorkspaceConfiguration = createTestplanConfiguration(
        'testplan'
    );
    const runner = new TestplanTestRunner('some-id', logger());

    test('should set runner id on initialization', () => {
        expect(runner).to.be.not.null;
        expect(runner.adapterId).to.be.equal('some-id');
    });

    test('should not return root suite when there is no tests', async () => {
        const configForEmptySuiteCollection: IWorkspaceConfiguration = createTestplanConfiguration(
            'python_extension_configured_testplan'
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
    });

    test('should discover tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        const labels = extractAllLabels(mainSuite!);

        expect(labels).to.have.deep.members([
            'Primary',
            'AlphaSuite',
            'test_equality_passed',
            'test_equality_failed',
            'test_membership_passed',
            'test_membership_failed',
            'test_regex_passed',
            'test_regex_failed',
            'Secondary',
            'BetaSuite',
            'testcase_one_passed',
            'testcase_two_passed'
        ]);
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
            'Secondary:BetaSuite:testcase_two_passed'
        ]);
    });
});

// suite('Run testplan tests with discovery errors', () => {
//     const config: IWorkspaceConfiguration = createTestplanConfiguration(
//         'testplan'
//     );
//     const runner = new TestplanTestRunner('some-id', logger());

//     [
//         'Error in invalid_syntax_test.py',
//         'Error in non_existing_module_test.py'
//     ].forEach(testMethod => {
//         test(`should run ${testMethod} test`, async () => {
//             const mainSuite = await runner.load(config);
//             expect(mainSuite).to.be.not.undefined;
//             const suite = findTestSuiteByLabel(mainSuite!, testMethod);
//             expect(suite).to.be.not.undefined;
//             const states = await runner.run(config, suite!.id);
//             expect(states).to.have.length(1);
//             expect(states[0].state).to.be.eq('failed');
//         });
//     });
// });

suite('Testplan test discovery with relative cwd folder', async () => {
    const config: IWorkspaceConfiguration = createTestplanConfiguration(
        'testplan',
        [],
        'basic'
    );
    const runner = new TestplanTestRunner('some-id', logger());

    test('should discover tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        const labels = extractAllLabels(mainSuite!);

        expect(labels).to.have.deep.members(['TestEcho','MyTestsuite','my_testcase']);
        const ids = extractAllIds(mainSuite!);
        expect(ids).to.have.deep.members(['TestEcho','TestEcho:MyTestsuite','TestEcho:MyTestsuite:my_testcase']);
    });
});

suite('Run testplan tests', () => {
    const config: IWorkspaceConfiguration = createTestplanConfiguration(
        'testplan'
    );
    const runner = new TestplanTestRunner('some-id', logger());

    test('should run all tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(mainSuite!.label).to.be.eq('Testplan tests');
        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        states.forEach(state => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });

    [
        {
            suite: { label: 'AlphaSuite', description: undefined },
            cases: [
                { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_equality_passed' },
                { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_equality_failed'},
                { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_membership_passed'},
                { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_membership_failed'},
                { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_regex_passed'},
                { file: 'test/test_plan.py', case: 'Primary:AlphaSuite:test_regex_failed'}
            ],
        },
        {
            suite: { label: 'BetaSuite', description: undefined },
            cases: [
                { file: 'test/test_plan.py', case: 'Secondary:BetaSuite:testcase_one_passed' },
                { file: 'test/test_plan.py', case: 'Secondary:BetaSuite:testcase_two_passed'}
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
            expect(states.map(s => s.test)).to.have.deep.members(
                cases.map(c => c.case)
            );
            states.forEach(state => {
                const expectedState = extractExpectedState(state.test as string);
                expect(state.state).to.be.eq(expectedState);
            });
        });
    });

    // [
    //     'test_one_plus_two_is_three_passed',
    //     'test_two_plus_two_is_five_failed',
    //     'test_capitalize_passed',
    //     'test_lower_passed',
    //     'test_passed[3-a-z]',
    //     'test_nested_class_methodC_passed',
    //     'test_d_passed',
    //     'removes_item_from_list_passed'
    // ].forEach(testMethod => {
    //     test(`should run ${testMethod} test`, async () => {
    //         const mainSuite = await runner.load(config);
    //         expect(mainSuite).to.be.not.undefined;
    //         const suite = findTestSuiteByLabel(mainSuite!, testMethod);
    //         expect(suite).to.be.not.undefined;
    //         const states = await runner.run(config, suite!.id);
    //         expect(states).to.be.not.empty;
    //         states.forEach(state => {
    //             const expectedState = extractExpectedState(state.test as string);
    //             expect(state.state).to.be.eq(expectedState);
    //         });
    //     });
    // });

    // test('should capture output from failing test', async () => {
    //     const mainSuite = await runner.load(config);
    //     expect(mainSuite).to.be.not.undefined;
    //     expect(extractErroredTests(mainSuite!)).to.be.empty;
    //     const suite = findTestSuiteByLabel(mainSuite!, 'test_two_plus_two_is_five_failed');
    //     expect(suite).to.be.not.undefined;
    //     const states = await runner.run(config, suite!.id);
    //     expect(states).to.be.have.length(1);
    //     const state = states[0];
    //     const expectedState = extractExpectedState(state.test as string);
    //     expect(state.state).to.be.eq(expectedState);
    //     expect(state.message).to.be.not.empty;
    //     expect(state.message).contains('Hello from test_two_plus_two_is_five_failed'); // stdout
    //     expect(state.message).contains('Hello from stderr in test_two_plus_two_is_five_failed'); // stderr
    //     expect(state.decorations).to.be.have.length(1);
    //     expect(state.decorations![0].line).to.be.equal(11);
    //     expect(state.decorations![0].message).to.satisfy((m: string) => m.startsWith('assert (2 + 2) == 5'));
    // });

    // [
    //     'test_environment_variable_from_env_file_passed',
    //     'test_environment_variable_from_process_passed'
    // ].forEach(testMethod => {
    //     test(`should load evironment variables for ${testMethod} test`, async () => {
    //         const mainSuite = await runner.load(config);
    //         expect(mainSuite).to.be.not.undefined;
    //         expect(extractErroredTests(mainSuite!)).to.be.empty;
    //         const suite = findTestSuiteByLabel(mainSuite!, testMethod);
    //         expect(suite).to.be.not.undefined;
    //         const states = await runner.run(config, suite!.id);
    //         expect(states).to.be.not.empty;
    //         states.forEach(state => {
    //             expect(state.state).to.be.eq(extractExpectedState(state.test as string));
    //         });
    //     });
    // });
});
