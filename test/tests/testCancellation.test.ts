import { expect } from 'chai';
import 'mocha';

import * as os from 'os';

import { PytestTestRunner } from '../../src/pytest/pytestTestRunner';
import { UnittestTestRunner } from '../../src/unittest/unittestTestRunner';
import { TestplanTestRunner } from '../../src/testplan/testplanTestRunner';
import {
    createPytestConfiguration,
    createUnittestConfiguration,
    createTestplanConfiguration,
    extractExpectedState,
    extractErroredTests,
    findTestSuiteByLabel,
    logger,
    sleep
} from '../utils/helpers';
import { isPython3 } from './utilities';

[
    {
        label: 'unittest',
        runner: new UnittestTestRunner('first-id', logger()),
        configuration: createUnittestConfiguration('unittest_test_cancellation'),
        allowNoTestCompleted: false,
    },
    {
        label: 'pytest',
        runner: new PytestTestRunner('second-id', logger()),
        configuration: createPytestConfiguration('pytest_test_cancellation'),
        allowNoTestCompleted: os.platform() === 'win32',
    },
    {
        label: 'testplan',
        runner: new TestplanTestRunner('third-id', logger()),
        configuration: createTestplanConfiguration('testplan_test_cancellation'),
        allowNoTestCompleted: isPython3(),
    }
].forEach(({ label, runner, configuration, allowNoTestCompleted }) => {
    (allowNoTestCompleted ? suite : suite.skip)(`Test cancellation with ${label}`, () => {

        test('should run and cancel all tests', async () => {
            const mainSuite = await runner.load(configuration);
            expect(mainSuite).to.be.not.undefined;
            expect(extractErroredTests(mainSuite!)).to.be.empty;
            const statesPromise = runner.run(configuration, mainSuite!.id);
            await sleep(1000);
            runner.cancel();
            const states = await statesPromise;

            // TODO: Fix completed test reporting on Windows when suite cancelled
            if (allowNoTestCompleted) {
                return;
            }
            expect(states).to.be.not.empty;
            expect(states).to.be.have.length(1);
            const singleState = states[0];
            const expectedState = extractExpectedState(singleState.test as string);
            expect(singleState.state).to.be.eq(expectedState);
        });

        test('should run and cancel single test', async () => {
            const mainSuite = await runner.load(configuration);
            expect(mainSuite).to.be.not.undefined;
            expect(extractErroredTests(mainSuite!)).to.be.empty;
            const suite = findTestSuiteByLabel(mainSuite!, 'test_sleep');
            expect(suite).to.be.not.undefined;
            const statesPromise = runner.run(configuration, suite!.id);
            await sleep(1000);
            runner.cancel();
            const states = await statesPromise;
            expect(states).to.be.empty;
        });
    });
});
