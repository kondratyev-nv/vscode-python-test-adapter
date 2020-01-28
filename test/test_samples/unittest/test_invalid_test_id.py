import unittest


class InvalidTestIdTests(unittest.TestCase):
    def __init__(self, methodName):
        unittest.TestCase.__init__(self, methodName)
        self.id = 123

    def test_two_plus_one_is_three_passed(self):
        self.assertEqual(3, 2 + 1)
