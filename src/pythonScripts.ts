
export const DISCOVER_TESTS_SCRIPT = `
import unittest

def print_suite(suite):
    if hasattr(suite, '__iter__'):
        for x in suite:
            print_suite(x)
    else:
        print(suite.id())


loader = unittest.TestLoader()
suites = loader.discover(".", pattern="*test*.py")
print_suite(suites)`;

export const RUN_TEST_SUIT_SCRIPT = `
from __future__ import print_function
import unittest
import sys
from base64 import b64encode


class TextTestResultWithSuccesses(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super(TextTestResultWithSuccesses, self).__init__(*args, **kwargs)
        self.successes = []

    def addSuccess(self, test):
        super(TextTestResultWithSuccesses, self).addSuccess(test)
        self.successes.append(test)


def load_tests(test_names):
    loader = unittest.TestLoader()
    if test_names:
        return loader.loadTestsFromNames(test_names)
    else:
        return loader.discover(".", pattern="*test*.py")


tests = load_tests(sys.argv[1:])
result = unittest.TextTestRunner(
    resultclass=TextTestResultWithSuccesses).run(tests)

for r in result.skipped:
    print("skipped:", r[0].id(), ":", b64encode(r[1].encode('utf8')).decode('ascii'))

for r in result.failures:
    print("failed:", r[0].id(), ":", b64encode(r[1].encode('utf8')).decode('ascii'))

for r in result.successes:
    print("passed:", r.id())`;
