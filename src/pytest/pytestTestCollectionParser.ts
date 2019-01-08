import * as path from 'path';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

import { empty } from '../utilities';

export function parseTestSuites(content: string, cwd: string): Array<TestSuiteInfo | TestInfo> {
    const token = parsePytestCollectionTokens(content, cwd);
    return getTests(token.tokens);
}

interface ITestToken {
    path: string;
    file: string;
    type: 'package' | 'module' | 'class' | 'method';
    level: number;
    tokens: ITestToken[];
}

function getTests(tokens: ITestToken[]): Array<TestSuiteInfo | TestInfo> {
    if (empty(tokens)) {
        return [];
    }
    return tokens.map(token => {
        if (token.type === 'module' || token.type === 'class') {
            const suite: TestSuiteInfo = {
                type: 'suite',
                id: token.path,
                label: getLabel(token.path),
                file: token.file,
                children: getTests(token.tokens),
            };
            return [suite];
        }
        if (token.type === 'method') {
            const test: TestInfo = {
                type: 'test',
                id: token.path,
                label: getLabel(token.path),
            };
            return [test];
        }
        return getTests(token.tokens);
    }).filter(x => x).map(x => x!).reduce((r, x) => r.concat(x), []);
}

function getLabel(tokenPath: string): string {
    const indexOfSplit = tokenPath.lastIndexOf('::');
    if (indexOfSplit < 0) {
        return path.basename(tokenPath);
    }
    return tokenPath.substring(indexOfSplit + 2);
}

function parseLine(line: string, level: number, parent: ITestToken): ITestToken | undefined {
    const nameBeginIndex = line.indexOf('\'');
    const nameEndIndex = line.lastIndexOf('\'');
    if (nameBeginIndex < 0 || nameEndIndex < 0 || (nameEndIndex - nameBeginIndex) < 1) {
        return undefined;
    }

    const name = line.substring(nameBeginIndex + 1, nameEndIndex);
    if (line.startsWith('<Package \'')) {
        return {
            path: name,
            file: name,
            type: 'package',
            level,
            tokens: [],
        };
    }

    if (line.startsWith('<Module \'')) {
        const modulePath = path.resolve(parent.path, name);
        return {
            path: modulePath,
            file: modulePath,
            type: 'module',
            level,
            tokens: [],
        };
    }

    if (line.startsWith('<Class \'') ||
        line.startsWith('<UnitTestCase \'') ||
        line.startsWith('<DescribeBlock \'')
    ) {
        return {
            path: `${parent.path}::${name}`,
            file: parent.file,
            type: 'class',
            level,
            tokens: [],
        };
    }

    if (line.startsWith('<TestCaseFunction \'') || line.startsWith('<Function \'')) {
        return {
            path: `${parent.path}::${name}`,
            file: parent.file,
            type: 'method',
            level,
            tokens: [],
        };
    }

    return undefined;
}

function parsePytestCollectionTokens(content: string, cwd: string): ITestToken {
    const rootTestSuite: ITestToken = {
        path: cwd,
        file: cwd,
        type: 'package',
        level: -1,
        tokens: [],
    };
    const testSuites: ITestToken[] = [rootTestSuite];
    content.split(/\r?\n/g)
        .forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                return;
            }

            const level = line.indexOf('<');
            if (level < 0) {
                return;
            }
            while (level <= testSuites[testSuites.length - 1].level) {
                testSuites.pop();
            }
            const parent = testSuites[testSuites.length - 1];
            const token = parseLine(trimmedLine, level, parent);
            if (!token) {
                return;
            }
            parent.tokens.push(token);
            testSuites.push(token);
        });
    return rootTestSuite;
}
