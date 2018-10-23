import { expect } from 'chai';
import 'mocha';
import * as path from 'path';

import { PytestTestRunner } from '../src/pytestTestRunner';
import { IWorkspaceConfiguration } from '../src/workspaceConfiguration';
import { createPytestConfiguration, findTestSuiteByLabel } from './helpers';

function extractExpectedState(name: string) {
    if (name.includes('[')) {
        name = name.split('[')[0];
    }
    return name.split('_').slice(-1)[0];
}

[
    'python',
    'python3'
].forEach(python => {
    suite(`Pytest test discovery with ${python}`, () => {
        const config: IWorkspaceConfiguration = createPytestConfiguration(python, 'pytest');
        const adapter = new PytestTestRunner('some-id');

        test('should return empty root suite for empty output', () => {
            expect(adapter).to.be.not.null;
            expect(adapter.adapterId).to.be.equal('some-id');
        });

        test('should discover any tests', async () => {
            const mainSuite = await adapter.load(config);
            expect(mainSuite).to.be.not.undefined;
            expect(mainSuite!.label).to.be.eq('All tests');
            expect(mainSuite!.children).to.be.not.empty;
        });

        test('should discover tests', async () => {
            const mainSuite = await adapter.load(config);
            expect(mainSuite).to.be.not.undefined;
            const expectedSuites = [
                'fixture_test.py',
                'generate_test.py',
                'inner_fixture_test.py',
                'string_test.py',
                'add_test.py'
            ];
            const labels = mainSuite!.children.map(x => x.label);
            expect(labels).to.have.members(expectedSuites);
        });
    });

    suite(`Run pytest tests with ${python}`, () => {
        const config: IWorkspaceConfiguration = createPytestConfiguration(python, 'pytest');
        const adapter = new PytestTestRunner('some-id');

        test('should run all tests', async () => {
            const mainSuite = await adapter.load(config);
            expect(mainSuite).to.be.not.undefined;
            expect(mainSuite!.label).to.be.eq('All tests');
            const states = await adapter.run(config, mainSuite!);
            expect(states).to.be.not.empty;
            states.forEach(state => {
                const expectedState = extractExpectedState(state.test as string);
                expect(state.state).to.be.eq(expectedState);
            });
        });

        [
            {
                suite: 'string_test.py',
                cases: [
                    { file: 'test/string_test.py', case: '::test_lower_passed' },
                    { file: 'test/string_test.py', case: '::test_capitalize_passed' },
                    {
                        file: 'test/string_test.py',
                        case: '::StringTestCaseOnSameLevelAsFunctions::test_capitalize_passed',
                    },
                    {
                        file: 'test/string_test.py',
                        case: '::StringTestCaseOnSameLevelAsFunctions::test_lower_passed',
                    }
                ],
            },
            {
                suite: 'add_test.py',
                cases: [
                    { file: 'test/inner_tests/add_test.py', case: '::test_one_plus_two_is_three_passed' },
                    { file: 'test/inner_tests/add_test.py', case: '::test_two_plus_two_is_five_failed' }
                ],
            },
            {
                suite: 'Test_NestedClassB',
                cases: [
                    {
                        file: 'test/inner_fixture_test.py',
                        case: '::Test_CheckMyApp::Test_NestedClassB::Test_nested_classC_Of_B::test_e_passed',
                    }
                ],
            }
        ].forEach(({ suite, cases }) => {
            test(`should run ${suite} suite`, async () => {
                const mainSuite = await adapter.load(config);
                expect(mainSuite).to.be.not.undefined;
                const suiteToRun = findTestSuiteByLabel(mainSuite!, suite);
                expect(suiteToRun).to.be.not.undefined;
                const states = await adapter.run(config, suiteToRun!);
                expect(states).to.be.not.empty;
                const cwd = config.getCwd();
                expect(states.map(s => s.test)).to.have.deep.members(
                    cases.map(c => path.resolve(cwd, c.file) + c.case)
                );
                states.forEach(state => {
                    const expectedState = extractExpectedState(state.test as string);
                    expect(state.state).to.be.eq(expectedState);
                });
            });
        });

        [
            'test_one_plus_two_is_three_passed',
            'test_two_plus_two_is_five_failed',
            'test_capitalize_passed',
            'test_lower_passed',
            'test_passed[3-a-z]',
            'test_nested_class_methodC_passed',
            'test_d_passed'
        ].forEach(testMethod => {
            test(`should run ${testMethod} test`, async () => {
                const mainSuite = await adapter.load(config);
                expect(mainSuite).to.be.not.undefined;
                const suite = findTestSuiteByLabel(mainSuite!, testMethod);
                expect(suite).to.be.not.undefined;
                const states = await adapter.run(config, suite!);
                expect(states).to.be.not.empty;
                states.forEach(state => {
                    const expectedState = extractExpectedState(state.test as string);
                    expect(state.state).to.be.eq(expectedState);
                });
            });
        });
    });
});
