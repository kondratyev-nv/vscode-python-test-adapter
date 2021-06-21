#!/usr/bin/env python

import sys
import time

from testplan import test_plan
from testplan.testing.multitest import MultiTest, testsuite, testcase

@testsuite
class SleepSuite(object):
    @testcase
    def test_sleep(self, env, result):
        time.sleep(20) # should be more than test timeout

@test_plan(name="Testplan cancellation")
def main(plan):
    plan.add(
        MultiTest(
            name="TestCancel",
            suites=[SleepSuite()]
        )
    )


if __name__ == "__main__":
    sys.exit(main().exit_code)
