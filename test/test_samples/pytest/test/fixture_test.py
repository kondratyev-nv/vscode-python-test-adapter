import pytest

numbers = [1, 2, 3, 4]
vowels = ['a', 'b', 'c']
consonants = ['x', 'y', 'z']


@pytest.fixture(params=numbers)
def number(request):
    return request.param


@pytest.fixture(params=vowels)
def vowel(request):
    return request.param


@pytest.fixture(params=consonants)
def consonant(request):
    return request.param


def test_passed(number, vowel, consonant):
    pass
