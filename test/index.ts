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

import * as path from 'path';
import * as testRunner from 'vscode/lib/testrunner';

import { runScript } from '../src/pythonRunner';

function getReporter() {
    const emptyOptions = {
        name: 'spec',
        options: {},
    };

    if (!process.env.CI_BUILD) {
        console.log('Not a CI build, using default reporter');
        return emptyOptions;
    }

    const testResultsFile = path.resolve(
        path.join(process.env.TEST_RESULT_DIRECTORY || './', 'test-results.xml')
    );
    console.log(`Results will be placed in ${testResultsFile}`);
    return {
        name: 'mocha-junit-reporter',
        options: {
            mochaFile: testResultsFile,
        },
    };
}

runScript({
    script: 'from __future__ import print_function; import sys; print(sys.executable, sys.version)',
    pythonPath: 'python',
    environment: {},
}).then(pythonInterpreter => console.log(`Using python ${pythonInterpreter}`));

const reporter = getReporter();
testRunner.configure(<any>{
    ui: 'tdd',       // the TDD UI is being used in extension.test.ts (suite, test, etc.)
    useColors: true, // colored output from test results
    timeout: 5000,
    reporter: reporter.name,
    reporterOptions: reporter.options,
});

module.exports = testRunner;

