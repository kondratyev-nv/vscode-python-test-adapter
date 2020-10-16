import pytest

def test_submodule_addition_passed():
    assert 2 + 2 == 4

@pytest.mark.subtraction
def test_submodule_subtraction_passed():
    assert 4 - 2 == 2
