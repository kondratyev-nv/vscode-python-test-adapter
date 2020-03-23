//
// PLEASE DO NOT MODIFY / DELETE UNLESS YOU KNOW WHAT YOU ARE DOING
//
// This file is providing the test runner to use when running extension tests.
// By default the test runner in use is Mocha based.
//
// You can provide your own test runner if you want to override it by exporting
// a function run(testRoot: string, clb: (error:Error) => void) that the extension
// host can call to run the tests. The test runner is expected to use console.log
// to report the results back to the caller. When the tests are finished, return
// a possible error to the callback or null if none.

import * as testRunner from 'vscode/lib/testrunner';
import { getReporter, getPythonExecutable } from './testConfiguration';
import { runScript } from '../src/pythonRunner';
import * as chai from 'chai';
import * as chaiString from 'chai-string';

chai.use(chaiString.default);

runScript({
    script: 'from __future__ import print_function; import sys; print(sys.executable, sys.version)',
    pythonPath: getPythonExecutable(),
    environment: {},
}).complete().then(({ output }) => console.log(`Using python ${output}`));

const reporter = getReporter();
console.log(`Using ${reporter.reporter || 'default'} reporter`);
testRunner.configure({
    ...{
        ui: 'tdd',       // the TDD UI is being used in extension.test.ts (suite, test, etc.)
        useColors: true, // colored output from test results
        slow: 1000,
        timeout: 10000,
    },
    ...reporter,
});

module.exports = testRunner;

