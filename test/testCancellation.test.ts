import { expect } from 'chai';
import 'mocha';

import { PytestTestRunner } from '../src/pytest/pytestTestRunner';
import { UnittestTestRunner } from '../src/unittest/unittestTestRunner';
import {
    createPytestConfiguration,
    createUnittestConfiguration,
    extractExpectedState,
    findTestSuiteByLabel,
    logger,
    sleep
} from './helpers';

[
    {
        label: 'unittest',
        runner: new UnittestTestRunner('first-id', logger()),
        configuration: createUnittestConfiguration('python', 'unittest_test_cancellation'),
    },
    {
        label: 'pytest',
        runner: new PytestTestRunner('second-id', logger()),
        configuration: createPytestConfiguration('python', 'pytest_test_cancellation'),
    }
].forEach(({ label, runner, configuration }) => {
    suite(`Test cancellation with ${label}`, () => {
        test('should run and cancel all tests', async () => {
            const mainSuite = await runner.load(configuration);
            expect(mainSuite).to.be.not.undefined;
            const statesPromise = runner.run(configuration, mainSuite!.id);
            await sleep(1000);
            runner.cancel();
            const states = await statesPromise;
            expect(states).to.be.not.empty;
            expect(states).to.be.have.length(1);
            const singleState = states[0];
            const expectedState = extractExpectedState(singleState.test as string);
            expect(singleState.state).to.be.eq(expectedState);
        }).slow(2000);

        test('should run and cancel single test', async () => {
            const mainSuite = await runner.load(configuration);
            expect(mainSuite).to.be.not.undefined;
            const suite = findTestSuiteByLabel(mainSuite!, 'test_sleep');
            expect(suite).to.be.not.undefined;
            const statesPromise = runner.run(configuration, suite!.id);
            await sleep(1000);
            runner.cancel();
            const states = await statesPromise;
            expect(states).to.be.empty;
        }).slow(2000);
    });
});
