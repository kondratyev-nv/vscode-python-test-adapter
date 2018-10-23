import unittest


def test_lower_passed():
    assert 'Sample'.lower() == 'sample'


def test_capitalize_passed():
    assert 'sample'.capitalize() == 'Sample'


class StringTestCaseOnSameLevelAsFunctions(unittest.TestCase):
    def test_lower_passed(self):
        self.assertEqual('sample', 'Sample'.lower())

    def test_capitalize_passed(self):
        self.assertEqual('Sample', 'sample'.capitalize())
