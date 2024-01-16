#!/usr/bin/env python
# Copied from https://github.com/morganstanley/testplan/blob/main/examples/Test%20Output/Console%20Output/Basic%20Configuration/test_plan.py
# This plan contains tests that demonstrate failures as well.
"""
This example shows how to configure console output for your tests
programmatically and via command line options.
"""
import sys

from testplan.testing.multitest import MultiTest, testsuite, testcase

from testplan import test_plan
from testplan.report.testing.styles import Style, StyleEnum


# Here is a sample test suite with failing / passing assertions and testcases.
# We can try out different console output styles to see
# how the test data gets printed.


@testsuite
class AlphaSuite(object):
    @testcase
    def test_equality_passed(self, env, result):
        result.equal(1, 1, description="passing equality")

    @testcase
    def test_equality_failed(self, env, result):
        result.equal(2, 1, description="failing equality")

    @testcase
    def test_membership_passed(self, env, result):
        result.contain(1, [1, 2, 3], description="passing membership")

    @testcase
    def test_membership_failed(self, env, result):
        result.contain(
            member=1,
            container={"foo": 1, "bar": 2},
            description="failing membership",
        )

    @testcase
    def test_regex_passed(self, env, result):
        result.regex.match(
            regexp="foo", value="foobar", description="passing regex match"
        )

    @testcase
    def test_regex_failed(self, env, result):
        result.regex.match(
            regexp="bar", value="foobaz", description="failing regex match"
        )


@testsuite
class BetaSuite(object):
    """
    This is the Beta Suite suite

    Nice to have some documentations as well.
    """
    @testcase
    def testcase_one_passed(self, env, result):
        "simple passing testcase"
        result.equal(1, 1, description="passing equality")

    @testcase
    def testcase_two_passed(self, env, result):
        result.equal("foo", "foo", description="another passing equality")


# The most verbose representation, prints out full
# assertion details for passing & failing testcases.
all_details_a = Style(passing="assertion-detail", failing="assertion-detail")
all_details_b = Style(
    passing=StyleEnum.ASSERTION_DETAIL, failing=StyleEnum.ASSERTION_DETAIL
)

# Terse representation, just prints out final result status, no details.
result_only_a = Style(passing="result", failing="result")
result_only_b = Style(passing=StyleEnum.RESULT, failing=StyleEnum.RESULT)

# A general good practice is to have more details for failing tests:

# Descriptions / names for passing assertions
# All details for failing assertions
style_1_a = Style(passing="assertion", failing="assertion-detail")
style_1_b = Style(
    passing=StyleEnum.ASSERTION, failing=StyleEnum.ASSERTION_DETAIL
)

# Testcase names for passing testcases
# Assertion descriptions / names for failing assertions
style_2_a = Style(passing="testcase", failing="assertion")
style_2_b = Style(passing=StyleEnum.TESTCASE, failing=StyleEnum.ASSERTION)

# Suite names for passing suites
# Testcase names for failing testcases
style_3_a = Style(passing="testsuite", failing="testcase")
style_3_b = Style(passing=StyleEnum.TESTSUITE, failing=StyleEnum.TESTCASE)

# Multitest names for passing multitest instances
# Suite names for failing suites

style_4_a = Style(passing="test", failing="testsuite")
style_4_b = Style(passing=StyleEnum.TEST, failing=StyleEnum.TESTSUITE)


# In addition to programmatic declarations above, we support limited
# console output styling options via `--stdout-style` argument:

# `--stdout-style result-only`: Displays final test plan result only.
# `--stdout-style summary`: Test level pass/fail status.
# `--stdout-style extended-summary`: Assertion details for failing
#                                    tests, testcase names for passing ones.
# `--stdout-style detailed`: Assertion details of both passing/failing tests.


# Replace the `stdout_style` argument with the styles defined
# above to see how they change console output.


@test_plan(
    name="Command line output configuration example",
    stdout_style=all_details_a,
)
def main(plan):

    multi_test_1_1 = MultiTest(name="Primary", suites=[AlphaSuite(), BetaSuite()], part=(0,4))
    multi_test_1_2 = MultiTest(name="Primary", suites=[AlphaSuite(), BetaSuite()], part=(1,4))
    multi_test_1_3 = MultiTest(name="Primary", suites=[AlphaSuite(), BetaSuite()], part=(2,4))
    multi_test_1_4 = MultiTest(name="Primary", suites=[AlphaSuite(), BetaSuite()], part=(3,4))
    multi_test_2 = MultiTest(name="Secondary", suites=[BetaSuite()])
    plan.add(multi_test_1_1)
    plan.add(multi_test_1_2)
    plan.add(multi_test_1_3)
    plan.add(multi_test_1_4)
    plan.add(multi_test_2)

    raise Exception("Error")

if __name__ == "__main__":
    sys.exit(not main())