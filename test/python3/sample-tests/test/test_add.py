import unittest


class AddTests(unittest.TestCase):
    def test_two_plus_one_is_three(self):
        self.assertEqual(3, 2 + 1)

    def test_two_plus_two_is_five(self):
        self.assertEqual(5, 2 + 2)

    @unittest.skip("Skipped for a very important reason")
    def test_two_plus_zero_is_two(self):
        self.assertEqual(2, 2 + 0)
