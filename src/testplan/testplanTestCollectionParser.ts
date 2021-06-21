import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

enum TestObjectType{APP, SUITE, TEST}

export function parseTestSuites(content: string): (TestSuiteInfo | TestInfo)[] {

    const suites: (TestSuiteInfo | TestInfo)[] = [];
    const parentStack: (TestSuiteInfo | TestInfo)[] = [];
    content.split(/[\r\n]+/)
        .map(line => line.trim())
        .filter(line => line)
        .map(line => line!)
        .forEach(line => {
            const data = line.split('::');
            const testRank = data.length - 1;
            if (testRank === TestObjectType.TEST)
            {
                const temp = {
                    type: 'test' as 'test',
                    id: data.join(':'),
                    label: data[testRank],
                };
                (parentStack[testRank - 1] as TestSuiteInfo).children.push(temp);
            }
            else
            {
                const temp = {
                    type: 'suite' as 'suite',
                    id: data.join(':'),
                    label: data[testRank],
                    children: [],
                };
                parentStack[testRank] = temp;
                if (testRank === TestObjectType.APP) {
                    suites.push(temp)
                }
                else
                {
                    (parentStack[testRank - 1] as TestSuiteInfo).children.push(temp);
                }
            }
        });

    return suites;
}