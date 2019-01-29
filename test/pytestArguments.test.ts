import { expect } from 'chai';
import 'mocha';
import * as path from 'path';

import { IWorkspaceConfiguration } from '../src/configuration/workspaceConfiguration';
import { PytestTestRunner } from '../src/pytest/pytestTestRunner';
import { createPytestConfiguration, extractExpectedState, findTestSuiteByLabel, logger } from './helpers';

suite('Pytest test discovery with additional arguments', async () => {
    const config: IWorkspaceConfiguration = createPytestConfiguration(
        'python',
        'pytest',
        [
            '--rootdir=test/inner_tests',
            '--trace',
            '--cache-show',
            '--doctest-modules',
            '--no-print-logs',
            '--collect-only',
            '--junitxml=sample.xml'
        ]);
    const runner = new PytestTestRunner('some-id', logger());

    test('should discover tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        const expectedSuites = [
            'arithmetic.py',
            'describe_test.py',
            'env_variables_test.py',
            'fixture_test.py',
            'generate_test.py',
            'inner_fixture_test.py',
            'string_test.py',
            'add_test.py (inner_tests)',
            'add_test.py (other_tests)'
        ];
        const labels = mainSuite!.children.map(x => x.label);
        expect(labels).to.have.members(expectedSuites);
    });
});

suite('Run pytest tests with additional arguments', () => {
    const config: IWorkspaceConfiguration = createPytestConfiguration(
        'python',
        'pytest',
        [
            '--rootdir',
            'test/inner_tests',
            '--trace',
            '--doctest-modules',
            '--no-print-logs',
            '--collect-only',
            '--junitxml=sample.xml',
            '--exitfirst'
        ]);
    const runner = new PytestTestRunner('some-id', logger());

    test('should run all tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(mainSuite!.label).to.be.eq('Pytest tests');
        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        states.forEach(state => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });

    [
        {
            suite: 'arithmetic.py',
            cases: [
                { file: 'src/arithmetic.py', case: '::arithmetic.add_failed' },
                { file: 'src/arithmetic.py', case: '::arithmetic.mul_passed' }
            ],
        }
    ].forEach(({ suite, cases }) => {
        test(`should run doctest ${suite} suite`, async () => {
            const mainSuite = await runner.load(config);
            expect(mainSuite).to.be.not.undefined;
            const suiteToRun = findTestSuiteByLabel(mainSuite!, suite);
            expect(suiteToRun).to.be.not.undefined;
            const states = await runner.run(config, suiteToRun!.id);
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
        'arithmetic.mul_passed',
        'arithmetic.add_failed'
    ].forEach(testMethod => {
        test(`should run doctest ${testMethod} test`, async () => {
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
});
