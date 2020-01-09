from __future__ import print_function
import pytest

@pytest.mark.add_test_passed
def test_one_plus_two_is_three_passed():
    print('Hello from test_one_plus_two_is_three_passed')
    assert (1 + 2) == 3


def test_two_plus_two_is_five_failed():
    print('Hello from test_two_plus_two_is_five_failed')
    assert (2 + 2) == 5
