import * as path from 'path';

export function getReporter() {
    if (!process.env.JUNIT_REPORTER_ENABLED) {
        return {};
    }

    const testResultsFile = path.resolve(
        path.join(process.env.JUNIT_REPORTER_RESULT_DIRECTORY || './', 'test-results.xml')
    );
    return {
        reporter: 'xunit',
        reporterOptions: {
            output: testResultsFile,
        },
    };
}

export function getPythonExecutable() {
    if (!process.env.VSCODE_PYTHON) {
        return 'python';
    }
    return process.env.VSCODE_PYTHON;
}
