import unittest


class AddTestsWithoutInit(unittest.TestCase):
    def test_two_plus_one_is_three_passed(self):
        print("checking 2 + 1")
        self.assertEqual(3, 2 + 1)

    def test_two_plus_two_is_five_failed(self):
        print("checking 2 + 2")
        self.assertEqual(5, 2 + 2)

    @unittest.skip("Skipped for a very important reason")
    def test_two_plus_zero_is_two_skipped(self):
        print("checking 2 + 0")
        self.assertEqual(2, 2 + 0)


if __name__ == '__main__':
    unittest.main()
