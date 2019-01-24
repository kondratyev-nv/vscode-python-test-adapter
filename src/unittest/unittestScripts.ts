

export const TEST_RESULT_PREFIX = 'TEST_EXECUTION_RESULT';

export function unittestHelperScript(configuration: { startDirectory: string, pattern: string }) {
    return `
from __future__ import print_function
from unittest import TextTestRunner, TextTestResult, TestLoader, TestSuite, defaultTestLoader as loader
import sys
import base64

TEST_RESULT_PREFIX = '${TEST_RESULT_PREFIX}'

class TextTestResultWithSuccesses(TextTestResult):
    def __init__(self, *args, **kwargs):
        super(TextTestResultWithSuccesses, self).__init__(*args, **kwargs)
        self.successes = []

    def addSuccess(self, test):
        super(TextTestResultWithSuccesses, self).addSuccess(test)
        self.successes.append(test)


class TextTestRunnerWithSingleResult(TextTestRunner):
    def __init__(self, *args, **kwargs):
        super(TextTestRunnerWithSingleResult, self).__init__(*args, **kwargs)
        self.single_result = TextTestResultWithSuccesses(self.stream, self.descriptions, self.verbosity)

    def _makeResult(self):
        return self.single_result


def get_tests(suite):
    if hasattr(suite, '__iter__'):
        tests = []
        for x in suite:
            tests.extend(get_tests(x))
        return tests
    else:
        return [suite]


def discover_tests():
    return get_tests(loader.discover("${configuration.startDirectory}", pattern="${configuration.pattern}"))


def filter_by_test_ids(tests, test_ids):
    if not test_ids:
        return tests
    return filter(lambda test: any(test.id().startswith(name) for name in test_ids), tests)

def write_test_state(state, result):
    message = base64.b64encode(result[1].encode('utf8')).decode('ascii')
    print("{}:{}:{}:{}".format(TEST_RESULT_PREFIX, state, result[0].id(), message))

def run_tests(test_names):
    runner = TextTestRunnerWithSingleResult()

    tests = [TestSuite([test]) for test in filter_by_test_ids(discover_tests(), test_names)]
    for test in tests:
        result = runner.run(test)
        for r in result.skipped:
            write_test_state("skipped", r)

        for r in result.failures:
            write_test_state("failed", r)

        for r in result.errors:
            write_test_state("failed", r)

        for r in result.successes:
            print("{}:{}:{}".format(TEST_RESULT_PREFIX, "passed", r.id()))


action = sys.argv[1]
if action == "discover":
    tests = discover_tests()
    print("==DISCOVERED TESTS==")
    for test in tests:
        print(test.id())
elif action == "run":
    run_tests(sys.argv[2:])
else:
    raise ValueError("invalid command: should be discover or run")`;
}
