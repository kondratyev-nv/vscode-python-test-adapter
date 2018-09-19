import unittest


class TestWithSetUpClassMethod(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.setUpClass_was_called = True

    def setUp(self):
        self.setUp_was_called = True

    def test_set_up_called_before_test_method_passed(self):
        assert self.setUpClass_was_called == True
        assert self.setUp_was_called == True
