print("Hello. I am here to break tests!")
import unittest

class TestWithOutputBeforeImport(unittest.TestCase):

    def test_stuff_passed(self):
        assert True
