

export const TEST_RESULT_PREFIX = 'TEST_EXECUTION_RESULT';

export const UNITTEST_TEST_RUNNER_SCRIPT = `
from __future__ import print_function
from unittest import TextTestRunner, TextTestResult, TestLoader, TestSuite, defaultTestLoader as loader
import sys
import base64

TEST_RESULT_PREFIX = '${TEST_RESULT_PREFIX}'

STDOUT_LINE = '\\nStdout:\\n%s'
STDERR_LINE = '\\nStderr:\\n%s'


def write_test_state(stream, state, result):
    message = base64.b64encode(result[1].encode('utf8')).decode('ascii')
    stream.writeln()
    stream.writeln("{}:{}:{}:{}".format(TEST_RESULT_PREFIX,
                                        state, result[0].id(), message))


class TextTestResultWithSuccesses(TextTestResult):
    def __init__(self, *args, **kwargs):
        super(TextTestResultWithSuccesses, self).__init__(*args, **kwargs)
        self.successes = []
        self.writtenResults = set()

    # similar to how unittest.TestResult done capturing
    def addSuccess(self, test):
        super(TextTestResultWithSuccesses, self).addSuccess(test)
        self.successes.append((test, self._execution_info_to_string(test)))
        self._mirrorOutput = True
        write_test_state(self.stream, "passed", self.successes[-1])

    def addError(self, test, err):
        super(TextTestResultWithSuccesses, self).addError(test, err)
        write_test_state(self.stream, "failed", self.errors[-1])

    def addFailure(self, test, err):
        super(TextTestResultWithSuccesses, self).addFailure(test, err)
        write_test_state(self.stream, "failed", self.failures[-1])

    def addSkip(self, test, reason):
        super(TextTestResultWithSuccesses, self).addSkip(test, reason)
        write_test_state(self.stream, "skipped", self.skipped[-1])

    def addExpectedFailure(self, test, err):
        super(TextTestResultWithSuccesses, self).addExpectedFailure(test, err)
        write_test_state(self.stream, "passed", self.expectedFailures[-1])

    def addUnexpectedSuccess(self, test):
        super(TextTestResultWithSuccesses, self).addUnexpectedSuccess(test)
        write_test_state(self.stream, "failed", self.unexpectedSuccesses[-1])

    def _execution_info_to_string(self, test):
        msgLines = []
        if self.buffer:
            output = sys.stdout.getvalue()
            error = sys.stderr.getvalue()
            if output:
                if not output.endswith('\\n'):
                    output += '\\n'
                msgLines.append(STDOUT_LINE % output)
            if error:
                if not error.endswith('\\n'):
                    error += '\\n'
                msgLines.append(STDERR_LINE % error)
        return ''.join(msgLines)


def get_tests(suite):
    if hasattr(suite, '__iter__'):
        tests = []
        for x in suite:
            tests.extend(get_tests(x))
        return tests
    else:
        return [suite]


def discover_tests(start_directory, pattern):
    return get_tests(loader.discover(start_directory, pattern=pattern))


def filter_by_test_ids(tests, test_ids):
    if not test_ids:
        return tests
    return filter(lambda test: any(test.id().startswith(name) for name in test_ids), tests)


def run_tests(start_directory, pattern, test_names):
    runner = TextTestRunner(
        buffer=True, resultclass=TextTestResultWithSuccesses, stream=sys.stdout)
    tests = filter_by_test_ids(discover_tests(
        start_directory, pattern), test_names)
    result = runner.run(TestSuite(tests))


action = sys.argv[1]
start_directory = sys.argv[2]
pattern = sys.argv[3]
if action == "discover":
    tests = discover_tests(start_directory, pattern)
    print("==DISCOVERED TESTS==")
    for test in tests:
        print(test.id())
elif action == "run":
    run_tests(start_directory, pattern, sys.argv[4:])
else:
    raise ValueError("invalid command: should be discover or run")`;
