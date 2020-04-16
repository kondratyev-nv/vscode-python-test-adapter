import unittest
import some_non_existing_module

class InvalidImportTests(unittest.TestCase):
    def test_with_invalid_import(self):
        self.assertEqual(3, 2 + 1)
