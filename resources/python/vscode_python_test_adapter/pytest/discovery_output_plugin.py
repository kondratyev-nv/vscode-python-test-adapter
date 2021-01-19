
from __future__ import print_function

import pytest
import sys
import json
import py


collected_errors = []


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


def extract_discovered_tests(session):
    tests = []
    for item in session.items:
        line = get_line_number(item)
        tests.append({'id': item.nodeid,
                      'line': line})
    return tests


def extract_discovery_errors():
    errors = []
    for error in collected_errors:
        try:
            errors.append({'file': error.location[0] if error.location else None,
                           'message': error.longreprtext})
        except:
            pass
    return errors


def pytest_collection_finish(session):
    print('==DISCOVERED TESTS BEGIN==')
    tests = extract_discovered_tests(session)
    errors = extract_discovery_errors()
    print(json.dumps({'tests': tests,
                      'errors': errors}))
    print('==DISCOVERED TESTS END==')


def pytest_collectreport(report):
    if report.failed:
        collected_errors.append(report)
