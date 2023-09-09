import { expect } from 'chai';
import 'mocha';
import * as path from 'path';
import * as fs from 'fs';
import { TestSuiteInfo } from 'vscode-test-adapter-api';
import { isFileExists } from '../../src/utilities/fs';
import { IWorkspaceConfiguration } from '../../src/configuration/workspaceConfiguration';
import { PytestTestRunner } from '../../src/pytest/pytestTestRunner';
import {
    createPytestConfiguration,
    extractExpectedState,
    extractErroredTests,
    findTestSuiteByLabel,
    logger,
} from '../utils/helpers';
import { PYTEST_EXPECTED_SUITES_LIST_WITHOUT_ERRORS } from '../utils/pytest';

suite('Pytest test discovery with additional arguments', async () => {
    const config: IWorkspaceConfiguration = createPytestConfiguration('pytest', [
        '--rootdir=test/inner_tests',
        '--trace',
        '--cache-show',
        '--doctest-modules',
        '--collect-only',
        '--junitxml=sample.xml',
        '--ignore=test/import_error_tests',
    ]);
    const runner = new PytestTestRunner('some-id', logger());

    test('should discover tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(extractErroredTests(mainSuite!)).to.be.empty;
        const labels = mainSuite!.children.map((x) => x.label);
        expect(labels).to.have.members(PYTEST_EXPECTED_SUITES_LIST_WITHOUT_ERRORS);
    });
});

suite('Run pytest tests with additional arguments', () => {
    const config: IWorkspaceConfiguration = createPytestConfiguration('pytest', [
        '--rootdir',
        'test/inner_tests',
        '--trace',
        '--doctest-modules',
        '--collect-only',
        '--junitxml=sample.xml',
        '--exitfirst',
        '--ignore=test/import_error_tests',
    ]);
    const runner = new PytestTestRunner('some-id', logger());

    test('should run all tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(extractErroredTests(mainSuite!)).to.be.empty;
        expect(mainSuite!.label).to.be.eq('Pytest tests');
        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        states.forEach((state) => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });

    [
        {
            suite: 'arithmetic.py',
            cases: [
                { file: 'src/arithmetic.py', case: '::arithmetic.add_failed' },
                { file: 'src/arithmetic.py', case: '::arithmetic.mul_passed' },
            ],
        },
    ].forEach(({ suite, cases }) => {
        test(`should run doctest ${suite} suite`, async () => {
            const mainSuite = await runner.load(config);
            expect(mainSuite).to.be.not.undefined;
            expect(extractErroredTests(mainSuite!)).to.be.empty;
            const suiteToRun = findTestSuiteByLabel(mainSuite!, suite);
            expect(suiteToRun).to.be.not.undefined;
            const states = await runner.run(config, suiteToRun!.id);
            expect(states).to.be.not.empty;
            const cwd = config.getCwd();
            expect(states.map((s) => s.test)).to.have.deep.members(
                cases.map((c) => path.resolve(cwd, c.file) + c.case)
            );
            states.forEach((state) => {
                const expectedState = extractExpectedState(state.test as string);
                expect(state.state).to.be.eq(expectedState);
            });
        });
    });

    ['arithmetic.mul_passed', 'arithmetic.add_failed'].forEach((testMethod) => {
        test(`should run doctest ${testMethod} test`, async () => {
            const mainSuite = await runner.load(config);
            expect(mainSuite).to.be.not.undefined;
            expect(extractErroredTests(mainSuite!)).to.be.empty;
            const suite = findTestSuiteByLabel(mainSuite!, testMethod);
            expect(suite).to.be.not.undefined;
            const states = await runner.run(config, suite!.id);
            expect(states).to.be.not.empty;
            states.forEach((state) => {
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
        {
            module: path.join('test', 'other_tests', 'add_test.py'),
            case: '::test_same_filename_one_plus_two_is_three_passed',
        },
    ];

    test('should discover only tests with specific mark', async () => {
        const config: IWorkspaceConfiguration = createPytestConfiguration('pytest', [
            '--ignore=test/import_error_tests',
            '-m',
            'add_test_passed',
        ]);
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(extractErroredTests(mainSuite!)).to.be.empty;
        expect(mainSuite!.label).to.be.eq('Pytest tests');
        const labels = mainSuite!.children.map((x) => x.file);
        expect(labels).to.have.members(markedTests.map((t) => path.join(config.getCwd(), t.module)));
    });

    test('should run only tests with specific mark', async () => {
        const config: IWorkspaceConfiguration = createPytestConfiguration('pytest', [
            '--ignore=test/import_error_tests',
            '-m',
            'add_test_passed',
        ]);
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(extractErroredTests(mainSuite!)).to.be.empty;
        expect(mainSuite!.label).to.be.eq('Pytest tests');
        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        const labels = states.map((x) => x.test);
        expect(labels).to.have.members(markedTests.map((t) => path.join(config.getCwd(), t.module) + t.case));
        states.forEach((state) => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });

    test('should not run tests with specific mark', async () => {
        const config: IWorkspaceConfiguration = createPytestConfiguration('pytest', [
            '--ignore=test/import_error_tests',
            '-m',
            'not add_test_passed',
        ]);
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(extractErroredTests(mainSuite!)).to.be.empty;
        expect(mainSuite!.label).to.be.eq('Pytest tests');
        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        const labels = states.map((x) => x.test);
        expect(labels).not.to.have.members(markedTests.map((t) => path.join(config.getCwd(), t.module) + t.case));
        states.forEach((state) => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });
});

suite('Pytest tests with additional positional arguments', () => {
    const config: IWorkspaceConfiguration = createPytestConfiguration('pytest', [
        '--rootdir',
        'test/inner_tests',
        'test/inner_tests',
        'test/other_tests',
    ]);
    const runner = new PytestTestRunner('some-id', logger());

    test('should discover tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(extractErroredTests(mainSuite!)).to.be.empty;
        const expectedSuites = ['add_test.py', 'add_test.py'];
        const labels = mainSuite!.children.map((x) => x.label);
        expect(labels).to.have.members(expectedSuites);
    });

    test('should run all tests', async () => {
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(extractErroredTests(mainSuite!)).to.be.empty;
        expect(mainSuite!.label).to.be.eq('Pytest tests');
        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        const labels = states.map((x) => x.test);
        expect(labels).to.have.members([
            path.join(config.getCwd(), 'test', 'inner_tests', 'add_test.py') + '::test_one_plus_two_is_three_passed',
            path.join(config.getCwd(), 'test', 'inner_tests', 'add_test.py') + '::test_two_plus_two_is_five_failed',
            path.join(config.getCwd(), 'test', 'other_tests', 'add_test.py') +
                '::test_same_filename_one_plus_two_is_three_passed',
            path.join(config.getCwd(), 'test', 'other_tests', 'add_test.py') +
                '::test_same_filename_two_plus_two_is_five_failed',
        ]);
        states.forEach((state) => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });
});

suite('Use junit-xml argument for pytest tests', () => {
    const runner = new PytestTestRunner('some-id', logger());

    test('should create junit-xml report by custom path', async () => {
        const now = new Date().getTime();
        const config: IWorkspaceConfiguration = createPytestConfiguration('pytest', [
            '--ignore=test/import_error_tests',
            `--junitxml=example_${now}.xml`,
        ]);
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(extractErroredTests(mainSuite!)).to.be.empty;

        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        states.forEach((state) => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });

        const reportFilePath = path.resolve(config.getCwd(), `example_${now}.xml`);
        expect(await isFileExists(reportFilePath)).to.be.true;
        try {
            fs.unlinkSync(reportFilePath);
        } catch {
            /* intentionally ignored */
        }
    });
});

suite('Run pytest suite with pytest.ini in subdirectory', () => {
    /**
     * In the first test we run all pytest tests and
     * expect that both tests from test_simple.py will be executed.
     * This is similar to running
     *     $ pytest -v --ignore=test/import_error_tests
     *     ...
     *     test/submodule/test_simple.py::test_submodule_addition_passed PASSED
     *     test/submodule/test_simple.py::test_submodule_subtraction_passed PASSED
     *     ...
     * from root folder (test/test_samples/pytest).
     *
     * In the second case we run tests from test/submodule/test_simple.py and
     * expect that _only one of two tests_ will be executed.
     * This is similar to running
     *     $ pytest -v --ignore=test/import_error_tests test/submodule/test_simple.py
     *     ...
     *     test/submodule/test_simple.py::test_submodule_subtraction_passed PASSED
     *     ...
     * from root folder (test/test_samples/pytest).
     *
     * This is how rootdir detection in pytest works:
     * https://docs.pytest.org/en/stable/customize.html#finding-the-rootdir
     */
    const runner = new PytestTestRunner('some-id', logger());

    test('should discover and run all tests', async () => {
        const config: IWorkspaceConfiguration = createPytestConfiguration('pytest', [
            '--ignore=test/import_error_tests',
        ]);
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(extractErroredTests(mainSuite!)).to.be.empty;
        const submoduleSuite = findTestSuiteByLabel(mainSuite!, 'test_simple.py') as TestSuiteInfo;
        expect(submoduleSuite).to.be.not.undefined;
        expect(submoduleSuite.type).to.be.eq('suite');
        expect(submoduleSuite.children).to.be.not.empty;

        const submoduleTestToSkip = findTestSuiteByLabel(mainSuite!, 'test_submodule_addition_passed')!.id;
        const submoduleTestToRun = findTestSuiteByLabel(mainSuite!, 'test_submodule_subtraction_passed')!.id;

        const states = await runner.run(config, runner.adapterId);
        expect(states).to.be.not.empty;
        expect(states.map((s) => s.test))
            .and.to.include(submoduleTestToRun)
            .and.to.include(submoduleTestToSkip);
        states.forEach((state) => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });

    test('should run suite in submodule', async () => {
        const config: IWorkspaceConfiguration = createPytestConfiguration('pytest', [
            '--ignore=test/import_error_tests',
        ]);
        const mainSuite = await runner.load(config);
        expect(mainSuite).to.be.not.undefined;
        expect(extractErroredTests(mainSuite!)).to.be.empty;
        const submoduleSuite = findTestSuiteByLabel(mainSuite!, 'test_simple.py') as TestSuiteInfo;
        expect(submoduleSuite).to.be.not.undefined;
        expect(submoduleSuite.type).to.be.eq('suite');
        expect(submoduleSuite.children).to.be.not.empty;

        const submoduleTestToRun = findTestSuiteByLabel(mainSuite!, 'test_submodule_subtraction_passed')!.id;

        const states = await runner.run(config, submoduleSuite.id);
        expect(states).to.be.not.empty;
        expect(states.map((s) => s.test))
            .to.be.lengthOf(1)
            .and.to.include(submoduleTestToRun);
        states.forEach((state) => {
            const expectedState = extractExpectedState(state.test as string);
            expect(state.state).to.be.eq(expectedState);
        });
    });
});
