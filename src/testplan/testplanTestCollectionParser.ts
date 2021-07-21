import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { ILogger } from '../logging/logger';

enum TestObjectType{
    APP = 0,
    SUITE = 1,
    TEST = 2,
}

// Example input:
// Primary
//   Primary::AlphaSuite
//     Primary::AlphaSuite::test_equality_passing
//     Primary::AlphaSuite::test_equality_failing
//     Primary::AlphaSuite::test_membership_passing
//     Primary::AlphaSuite::test_membership_failing
// Secondary
//   Secondary::BetaSuite
//     Secondary::BetaSuite::passing_testcase_one
//     Secondary::BetaSuite::passing_testcase_two
export function parseTestSuites(content: string, logger: ILogger): (TestSuiteInfo | TestInfo)[] {

    const suites: (TestSuiteInfo | TestInfo)[] = [];
    const parentStack: TestSuiteInfo[] = [];
    content.split(/[\r\n]+/)
        .map(line => line.trim())
        .filter(line => line)
        .map(line => line!)
        .forEach(line => {
            const data = line.split('::');
            const testRank = data.length - 1;

            if (testRank < parentStack.length) {
                parentStack.pop()
            }

            switch (testRank) {
                case TestObjectType.APP: {
                    logger.log('info', 'App found ${data}');
                    const appSuite = newTestSuite(data, testRank);

                    parentStack.push(appSuite);
                    suites.push(appSuite);
                    break;
                }
                case TestObjectType.SUITE: {
                    logger.log('info', 'Suite found ${data}');
                    const suite = newTestSuite(data, testRank);

                    parentStack[parentStack.length - 1].children.push(suite);
                    parentStack.push(suite);
                    break;
                }
                case TestObjectType.TEST: {
                    logger.log('info', 'Test found ${data}');
                    const test = newTest(data);
                    parentStack[parentStack.length - 1].children.push(test);
                    break;
                }
            }
        });

    return suites;
}

function newTest(data : string[]): TestInfo {
    return {
        type: 'test' as 'test',
        id: data.join(':'), // Testplan can use this format to address a suite/test to run
        label: data[TestObjectType.TEST],
    };
}

function newTestSuite(data : string[], testRank : TestObjectType): TestSuiteInfo {
    return {
        type: 'suite' as 'suite',
        id: data.join(':'), // Testplan can use this format to address a suite/test to run
        label: data[testRank],
        children: [],
    };
}