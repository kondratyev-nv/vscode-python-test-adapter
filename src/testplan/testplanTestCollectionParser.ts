// import * as os from 'os';
// import { Test } from 'mocha';
// import * as path from 'path';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
// import { readDirR, readFile } from '../utilities/fs';

// import { empty, groupBy } from '../utilities/collections';

// interface IDiscoveryResultJson {
//     app: string,
//     suite: string,
//     test: string
// }

enum TestObjectType{APP,SUITE,TEST}
// const TestObjectArray: Array<'suite' | 'test'> = ['suite','suite' ,'test']

export function parseTestSuites(content: string, cwd: string): (TestSuiteInfo | TestInfo)[] {
    // const discoveredTestsJson = content.substring(from + DISCOVERED_TESTS_START_MARK.length, to);
    // const discoveryResult = JSON.parse(discoveredTestsJson) as IDiscoveryResultJson;
    // const allTests = (discoveryResult.tests || [])
    //     .map(line => ({ ...line, id: line.id.replace(/::\(\)/g, '') }))
    //     .filter(line => line.id)
    //     .map(line => splitModule(line, cwd))
    //     .filter(line => line)
    //     .map(line => line!);

    console.log(cwd);
    var suites: Array<TestSuiteInfo | TestInfo> = [];
    var parentStack: Array<TestSuiteInfo | TestInfo> = [];
    content.split(/[\r\n]+/)
        .map(line => line.trim())
        .filter(line => line)
        .map(line => line!)
        .forEach(line => {
            const data = line.split('::');
            const testRank = data.length-1;
            if (testRank == TestObjectType.TEST)
            {
                const temp = {
                    type: 'test' as 'test',
                    id: data.join(':'),
                    label: data[testRank],
                    // file: path.join(cwd,"suites", "example.py"),
                    // line: 5,
                };
                (parentStack[testRank-1] as TestSuiteInfo).children.push(temp);
            }
            else
            {
                const temp = {
                    type: 'suite' as 'suite',
                    id: data.join(':'),
                    label: data[testRank],
                    // file: path.join(cwd,"suites", "example.py"),
                    // line: 5,
                    children: []
                };
                parentStack[testRank] = temp;
                if (testRank == TestObjectType.APP) {
                    suites.push(temp)
                }
                else
                {
                    (parentStack[testRank-1] as TestSuiteInfo).children.push(temp);
                }
            }
        });

    // fillFilesForApps(suites, cwd)
    return suites;
}

// function fillFilesForApps(suites: (TestSuiteInfo | TestInfo)[], cwd: string) {
//     suites.forEach(async app => {
//         //find where are the apps

//         app.file = cwd
//         app.line = await getLine(app.file, app.label);
//         fillFilesForSuites((app as TestSuiteInfo).children, cwd)
//     })
// }

// function fillFilesForSuites(suites: (TestSuiteInfo | TestInfo)[], cwd: string) {
//     suites.forEach(async suite => {
//         //find where are the suite
//         readDirR(cwd,true);
//         suite.file = cwd
//         suite.line = await getLine(suite.file, suite.label);
//         fillFilesForTests((suite as TestSuiteInfo).children, suite.file)
//     })
// }

// function fillFilesForTests(tests: (TestSuiteInfo | TestInfo)[], suiteFile: string) {
//     tests.forEach(async test => {
//         test.file = suiteFile;
//         test.line = await getLine(suiteFile, test.label);
//     })
// }

// async function getLine(file:string, text:string) : Promise<number> {
//     const content = await readFile(file);
//     const tempStr = content.substring(0,content.indexOf(text));
//     return tempStr.split('\n').length;
// }