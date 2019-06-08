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
    if (!process.env.JUNIT_REPORTER_ENABLED) {
        console.log('JUNIT_REPORTER_ENABLED variable is not defined, using default reporter');
        return {};
    }

    const testResultsFile = path.resolve(
        path.join(process.env.JUNIT_REPORTER_RESULT_DIRECTORY || './', 'test-results.xml')
    );
    console.log(`Results will be placed in ${testResultsFile}`);
    return {
        reporter: 'xunit',
        reporterOptions: {
            output: testResultsFile,
        },
    };
}

runScript({
    script: 'from __future__ import print_function; import sys; print(sys.executable, sys.version)',
    pythonPath: 'python',
    environment: {},
}).complete().then(({ output }) => console.log(`Using python ${output}`));

const reporter = getReporter();
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

