
from __future__ import print_function

import pytest
import sys
import json
import py


def get_line_number(item):
    location = getattr(item, 'location', None)
    if location is not None:
        return location[1]
    obj = getattr(item, 'obj', None)
    if obj is not None:
        try:
            from _pytest.compat import getfslineno
            return getfslineno(obj)[1]
        except:
            pass
    return None


class PythonTestExplorerDiscoveryOutputPlugin(object):
    def __init__(self):
        self.errors = []

    def __extract_discovered_tests(self, session):
        tests = []
        for item in session.items:
            line = get_line_number(item)
            tests.append({'id': item.nodeid,
                          'line': line})
        return tests

    def __extract_discovery_errors(self):
        errors = []
        for error in self.errors:
            try:
                errors.append({'file': error.location[0] if error.location else None,
                               'message': error.longreprtext})
            except:
                pass
        return errors

    def pytest_collection_finish(self, session):
        print('==DISCOVERED TESTS BEGIN==')
        tests = self.__extract_discovered_tests(session)
        errors = self.__extract_discovery_errors()
        print(json.dumps({'tests': tests,
                          'errors': errors}))
        print('==DISCOVERED TESTS END==')

    def pytest_collectreport(self, report):
        if report.failed:
            self.errors.append(report)


pytest.main(sys.argv[1:], plugins=[PythonTestExplorerDiscoveryOutputPlugin()])