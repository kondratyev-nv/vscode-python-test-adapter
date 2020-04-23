import unittest

class StringTestWithSimilarNames(unittest.TestCase):
    def test_string_passed(self):
        self.assertEqual('sample', 'Sample'.lower())

    # Test name starts with the same name as above.
    def test_string_passed_capitalize_passed(self):
        self.assertEqual('Sample', 'sample'.capitalize())
