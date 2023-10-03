export const TEST_RESULT_PREFIX = 'TEST_EXECUTION_RESULT';

export const UNITTEST_TEST_RUNNER_SCRIPT = `
from __future__ import print_function
from unittest import TextTestRunner, TextTestResult, TestLoader, TestSuite, defaultTestLoader, util
import sys
import os
import re
import base64
import json
import traceback

def setup_django_test_env(root):
    """Configure Django environment for running Django tests.
    It checks if Django is installed by attempting to import the django module.
    Looks for manage.py file to extract the value of DJANGO_SETTINGS_MODULE.
    Sets DJANGO_SETTINGS_MODULE environment variable and initializes Django setup.
    If any errors occur during this process, the function fails silently.
    Args:
        root (str): The root directory of the Django project.
    Returns:
        None.
    """
    import os
    try:
        # Check if Django is installed
        import django
        # Check if manage.py exists
        with open(os.path.join(root, "manage.py"), "r") as manage_py:
            # Look for a line that sets the DJANGO_SETTINGS_MODULE environment variable
            for line in manage_py.readlines():
                if line.strip().startswith("os.environ.setdefault"):
                    eval(line.strip())
                    django.setup()
                    return
    except (ModuleNotFoundError, FileNotFoundError):
        return

TEST_RESULT_PREFIX = '${ TEST_RESULT_PREFIX }'

STDOUT_LINE = '\\nStdout:\\n%s'
STDERR_LINE = '\\nStderr:\\n%s'


def writeln(stream, value=None):
    if value:
        stream.write(value)
    stream.write(os.linesep)


def write_test_state(stream, state, test_id, output):
    message = base64.b64encode(output.encode('utf8')).decode('ascii')
    writeln(stream)
    writeln(stream, "{}:{}:{}:{}".format(TEST_RESULT_PREFIX, state, test_id, message))


def full_class_name(o):
  module = o.__class__.__module__
  if module is None or module == str.__class__.__module__:
    return o.__class__.__name__
  else:
    return module + '.' + o.__class__.__name__


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
        write_test_state(self.stream, "passed", self.successes[-1][0].id(), self.successes[-1][1])

    def addError(self, test, err):
        super(TextTestResultWithSuccesses, self).addError(test, err)
        if full_class_name(self.errors[-1][0]) == 'unittest.suite._ErrorHolder':
            match = re.match(".*[(](.+)[)]", self.errors[-1][0].id())
            actual_test_id = match.group(1) if match is not None else self.errors[-1][0].id()
            write_test_state(self.stream, "failed", actual_test_id, self.errors[-1][1])
        else:
            write_test_state(self.stream, "failed", self.errors[-1][0].id(), self.errors[-1][1])

    def addFailure(self, test, err):
        super(TextTestResultWithSuccesses, self).addFailure(test, err)
        write_test_state(self.stream, "failed", self.failures[-1][0].id(), self.failures[-1][1])

    def addSkip(self, test, reason):
        super(TextTestResultWithSuccesses, self).addSkip(test, reason)
        write_test_state(self.stream, "skipped", self.skipped[-1][0].id(), self.skipped[-1][1])

    def addExpectedFailure(self, test, err):
        super(TextTestResultWithSuccesses, self).addExpectedFailure(test, err)
        write_test_state(self.stream, "passed", self.expectedFailures[-1][0].id(), self.expectedFailures[-1][1])

    def addUnexpectedSuccess(self, test):
        super(TextTestResultWithSuccesses, self).addUnexpectedSuccess(test)
        write_test_state(self.stream, "failed", self.unexpectedSuccesses[-1][0].id(), self.unexpectedSuccesses[-1][1])

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


class InvalidTest:
    def __init__(self, test, exception):
        self.test = test
        self.exception = exception

    def id(self):
        return self.test


def get_invalid_test_name(test):
    if hasattr(test, '_testMethodName'):
        return test._testMethodName
    return util.strclass(test.__class__)


def get_python3_invalid_test(test):
    if hasattr(test, '_exception'):
        return InvalidTest(get_invalid_test_name(test), test._exception)
    return None


def get_python2_invalid_test(test):
    test_class_name = full_class_name(test)
    if test_class_name == 'unittest.loader.ModuleImportFailure' or test_class_name == 'unittest.loader.LoadTestsFailure':
        result = TextTestResult(sys.stderr, True, 1)
        test.run(result)
        if not result.errors:
            return InvalidTest(get_invalid_test_name(test), "Failed to load test: " + test_class_name)
        return InvalidTest(get_invalid_test_name(test), "\\n".join(list(map(lambda e: e[1], result.errors))))
    return None


def check_test_ids(tests):
    valid_tests = []
    invalid_tests = []
    for test in tests:
        p3error = get_python3_invalid_test(test)
        if p3error is not None:
            invalid_tests.append(p3error)
            continue

        p2error = get_python2_invalid_test(test)
        if p2error is not None:
            invalid_tests.append(p2error)
            continue

        try:
            test.id()  # check if test id is valid
            valid_tests.append(test)
        except Exception as exception:
            name = util.strclass(test.__class__)
            message = 'Failed to get test id: %s\\n%s' % (
                name, traceback.format_exc())
            invalid_tests.append(InvalidTest(name, Exception(message)))
    return (valid_tests, invalid_tests)


def discover_tests(start_directory, pattern):
    tests = get_tests(defaultTestLoader.discover(start_directory, pattern=pattern))
    return check_test_ids(tests)


def filter_by_test_ids(tests, test_ids):
    if not test_ids:
        return tests
    tests_by_id = {}
    for test_id in test_ids:
        tests_by_id[test_id] = []
    for test in tests:
        if test.id() in tests_by_id:
            tests_by_id[test.id()].append(test)
        else:
            matching_ids = [test_id for test_id in test_ids if test.id().startswith(test_id + '.')]
            for test_id in matching_ids:
                tests_by_id[test_id].append(test)
    unique_tests = {}
    for test_id, matching_tests in tests_by_id.items():
        for matching_test in matching_tests:
            unique_tests[matching_test.id()] = matching_test
    return unique_tests.values()


def run_tests(start_directory, pattern, test_ids):
    runner = TextTestRunner(
        buffer=True, resultclass=TextTestResultWithSuccesses, stream=sys.stdout)
    available_tests, invalid_tests = discover_tests(start_directory, pattern)
    result = runner.run(TestSuite(filter_by_test_ids(available_tests, test_ids)))
    for invalid_test in filter_by_test_ids(invalid_tests, test_ids):
        write_test_state(sys.stdout, "failed", invalid_test.id(), str(invalid_test.exception))


def extract_errors(tests):
    return [{'class': test.test, 'message': str(test.exception)} for test in tests]


action = sys.argv[1]
start_directory = sys.argv[2]
pattern = sys.argv[3]
setup_django_test_env(start_directory)
if action == "discover":
    valid_tests, invalid_tests = discover_tests(start_directory, pattern)
    print('==DISCOVERED TESTS BEGIN==')
    print(json.dumps({'tests': [{'id': test.id()} for test in valid_tests],
                      'errors': extract_errors(invalid_tests)}))
    print('==DISCOVERED TESTS END==')
elif action == "run":
    run_tests(start_directory, pattern, sys.argv[4:])
else:
    raise ValueError("invalid command: should be discover or run")
`;
