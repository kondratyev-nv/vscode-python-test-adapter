import unittest


class TestWithSetUpClassMethod(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        if hasattr(cls, 'setUpClass_was_called'):
            cls.setUpClass_was_called += 1
        else:
            cls.setUpClass_was_called = 1

    def setUp(self):
        if hasattr(self, 'setUp_was_called'):
            self.setUp_was_called += 1
        else:
            self.setUp_was_called = 1

    def test_set_up_called_before_test_case1_passed(self):
        assert self.setUpClass_was_called == 1
        assert self.setUp_was_called == 1

    def test_set_up_called_before_test_case2_passed(self):
        assert self.setUpClass_was_called == 1
        assert self.setUp_was_called == 1
