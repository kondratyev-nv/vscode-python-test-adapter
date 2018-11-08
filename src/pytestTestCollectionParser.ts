import * as path from 'path';
import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

import { empty } from './utilities';

export function parseTestSuites(content: string, cwd: string): TestSuiteInfo[] {
    const token = parsePytestCollectionTokens(content, cwd);
    return linearizeToTestSuites(token)
        .filter(t => !empty(t.children));
}

interface ITestToken {
    path: string;
    file: string;
    type: 'module' | 'class' | 'method' | 'package';
    level: number;
    tokens: ITestToken[];
}

function linearizeToTestSuites(token: ITestToken): TestSuiteInfo[] {
    if (empty(token.tokens)) {
        return [];
    }
    if (token.type === 'module') {
        const suite: TestSuiteInfo = {
            type: 'suite',
            id: token.path,
            label: getLabel(token.path),
            file: token.file,
            children: getTests(token.tokens),
        };
        return [suite];
    }
    return token.tokens.map(t => linearizeToTestSuites(t)).reduce((r, x) => r.concat(x), []);
}

function getTests(tokens: ITestToken[]): Array<TestSuiteInfo | TestInfo> {
    if (empty(tokens)) {
        return [];
    }
    return tokens.map(token => {
        if (token.type === 'class') {
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

function getLabel(casePath: string): string {
    const indexOfSplit = casePath.lastIndexOf('::');
    if (indexOfSplit < 0) {
        return path.basename(casePath);
    }
    return casePath.substring(indexOfSplit + 2);
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

    if (line.startsWith('<Class \'') || line.startsWith('<UnitTestCase \'')) {
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
