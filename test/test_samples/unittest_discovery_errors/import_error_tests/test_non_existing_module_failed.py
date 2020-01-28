import unittest
import some_non_existing_module


class ImportNonExistingModuleTests(unittest.TestCase):
    def test_two_plus_one_is_three_passed(self):
        self.assertEqual(3, 2 + 1)
