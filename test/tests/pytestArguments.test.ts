import { expect } from 'chai';
import 'mocha';
import * as path from 'path';

import { IWorkspaceConfiguration } from '../../src/configuration/workspaceConfiguration';
import { PytestTestRunner } from '../../src/pytest/pytestTestRunner';
import { createPytestConfiguration, extractExpectedState, findTestSuiteByLabel, logger } from '../utils/helpers';

suite('Pytest test discovery with additional arguments', async () => {
    const config: IWorkspaceConfiguration = createPytestConfiguration(
        'pytest',
        [
            '--rootdir=test/inner_tests',
            '--trace',
            '--cache-show',
            '--doctest-modules',
            '--no-print-logs',
            '--collect-only',
            '--junitxml=sample.xml',
            '--ignore=test/import_error_tests'
        ]);
    const runner = new PytestTestRunner('some-id', logger());

    test('should discover tests', async () => {
        const { suite: mainSuite, errors } = await runner.load(config);
        expect(errors).to.be.empty;
        expect(mainSuite).to.be.not.undefined;
        const expectedSuites = [
            'arithmetic.py',
            'describe_test.py',
            'env_variables_test.py',
            'fixture_test.py',
            'generate_test.py',
            'inner_fixture_test.py',
            'string_test.py',
            'subprocess_test.py',
            'add_test.py',
            'add_test.py'
        ];
        const labels = mainSuite!.children.map(x => x.label);
        expect(labels).to.have.members(expectedSuites);
    });
});

suite('Run pytest tests with additional arguments', () => {
    const config: IWorkspaceConfiguration = createPytestConfiguration(
        'pytest',
        [
            '--rootdir',
            'test/inner_tests',
            '--trace',
            '--doctest-modules',
            '--no-print-logs',
            '--collect-only',
            '--junitxml=sample.xml',
            '--exitfirst',
            '--ignore=test/import_error_tests'
        ]);
    const runner = new PytestTestRunner('some-id', logger());

    test('should run all tests', async () => {
        const { suite: mainSuite, errors } = await runner.load(config);
        expect(errors).to.be.empty;
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
            const { suite: mainSuite, errors } = await runner.load(config);
            expect(errors).to.be.empty;
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
            const { suite: mainSuite, errors } = await runner.load(config);
            expect(errors).to.be.empty;
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

suite('Filter pytest tests by mark arguments', () => {
    const runner = new PytestTestRunner('some-id', logger());
    const markedTests = [
        { module: path.join('test', 'inner_tests', 'add_test.py'), case: '::test_one_plus_two_is_three_passed' },
        { module: path.join('test', 'other_tests', 'add_test.py'), case: '::test_same_filename_one_plus_two_is_three_passed' }
    ];

    test('should discover only tests with specific mark', async () => {
        const config: IWorkspaceConfiguration = createPytestConfiguration(
            'pytest',
            [
                '--ignore=test/import_error_tests',
                '-m',
                'add_test_passed'
            ]);
        const { suite: mainSuite, errors } = await runner.load(config);
        expect(errors).to.be.empty;
        expect(mainSuite).to.be.not.undefined;
        expect(mainSuite!.label).to.be.eq('Pytest tests');
        const labels = mainSuite!.children.map(x => x.file);
        expect(labels).to.have.members(markedTests.map(t => path.join(config.getCwd(), t.module)));
    });

    test('should run only tests with specific mark', async () => {
        const config: IWorkspaceConfiguration = createPytestConfiguration(
            'pytest',
            [
                '--ignore=test/import_error_tests',
                '-m',
                'add_test_passed'
            ]);
        const { suite: mainSuite, errors } = await runner.load(config);
        expect(errors).to.be.empty;
        expect(mainSuite).to.be.not.undefined;
        expect(mainSuite!.label).to.be.eq('Pytest tests');
        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        const labels = states.map(x => x.test);
        expect(labels).to.have.members(markedTests.map(t => path.join(config.getCwd(), t.module) + t.case));
        states.forEach(state => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });

    test('should not run tests with specific mark', async () => {
        const config: IWorkspaceConfiguration = createPytestConfiguration(
            'pytest',
            [
                '--ignore=test/import_error_tests',
                '-m',
                'not add_test_passed'
            ]);
        const { suite: mainSuite, errors } = await runner.load(config);
        expect(errors).to.be.empty;
        expect(mainSuite).to.be.not.undefined;
        expect(mainSuite!.label).to.be.eq('Pytest tests');
        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        const labels = states.map(x => x.test);
        expect(labels).not.to.have.members(markedTests.map(t => path.join(config.getCwd(), t.module) + t.case));
        states.forEach(state => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });
});

suite('Pytest tests with additional positional arguments', () => {
    const config: IWorkspaceConfiguration = createPytestConfiguration(
        'pytest',
        [
            '--rootdir',
            'test/inner_tests',
            'test/inner_tests',
            'test/other_tests'
        ]);
    const runner = new PytestTestRunner('some-id', logger());

    test('should discover tests', async () => {
        const { suite: mainSuite, errors } = await runner.load(config);
        expect(errors).to.be.empty;
        expect(mainSuite).to.be.not.undefined;
        const expectedSuites = [
            'add_test.py',
            'add_test.py'
        ];
        const labels = mainSuite!.children.map(x => x.label);
        expect(labels).to.have.members(expectedSuites);
    });

    test('should run all tests', async () => {
        const { suite: mainSuite, errors } = await runner.load(config);
        expect(errors).to.be.empty;
        expect(mainSuite).to.be.not.undefined;
        expect(mainSuite!.label).to.be.eq('Pytest tests');
        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        const labels = states.map(x => x.test);
        expect(labels).to.have.members([
            path.join(config.getCwd(), 'test', 'inner_tests', 'add_test.py') + '::test_one_plus_two_is_three_passed',
            path.join(config.getCwd(), 'test', 'inner_tests', 'add_test.py') + '::test_two_plus_two_is_five_failed',
            path.join(config.getCwd(), 'test', 'other_tests', 'add_test.py') + '::test_same_filename_one_plus_two_is_three_passed',
            path.join(config.getCwd(), 'test', 'other_tests', 'add_test.py') + '::test_same_filename_two_plus_two_is_five_failed'
        ]);
        states.forEach(state => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });
});
