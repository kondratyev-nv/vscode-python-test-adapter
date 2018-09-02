
export function discoverTestsScript(configuration: { startDirectory: string, pattern: string }) {
    return `
import unittest

def print_suite(suite):
    if hasattr(suite, '__iter__'):
        for x in suite:
            print_suite(x)
    else:
        print(suite.id())


loader = unittest.TestLoader()
suites = loader.discover("${configuration.startDirectory}", pattern="${configuration.pattern}")
print_suite(suites)`;
}

export function runTestSuitScript(configuration: { startDirectory: string, pattern: string }) {
    return `
from __future__ import print_function
from unittest import TextTestRunner, TextTestResult, TestLoader
import sys
import base64


class TextTestResultWithSuccesses(TextTestResult):
    def __init__(self, *args, **kwargs):
        super(TextTestResultWithSuccesses, self).__init__(*args, **kwargs)
        self.successes = []

    def addSuccess(self, test):
        super(TextTestResultWithSuccesses, self).addSuccess(test)
        self.successes.append(test)


def get_tests(suite):
    if hasattr(suite, '__iter__'):
        tests = []
        for x in suite:
            tests.extend(get_tests(x))
        return tests
    else:
        return [suite]


def load_tests(test_names):
    loader = TestLoader()
    suites = loader.discover("${configuration.startDirectory}", pattern="${configuration.pattern}")
    all_tests = get_tests(suites)
    if not test_names:
        return all_tests
    return filter(lambda test: any(test.id().startswith(name) for name in test_names), all_tests)


tests = load_tests(sys.argv[1:])
runner = TextTestRunner(resultclass=TextTestResultWithSuccesses)
results = [runner.run(test) for test in tests]

for result in results:
    for r in result.skipped:
        print("skipped:", r[0].id(), ":", base64.b64encode(
            r[1].encode('utf8')).decode('ascii'))

    for r in result.failures:
        print("failed:", r[0].id(), ":", base64.b64encode(
            r[1].encode('utf8')).decode('ascii'))

    for r in result.successes:
        print("passed:", r.id())`;
}
