from __future__ import print_function
import unittest


class TestWithSetUpClassMethod(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        if hasattr(cls, 'setUpClass_was_called'):
            print('setUpClass was called', cls.setUpClass_was_called)
            cls.setUpClass_was_called += 1
        else:
            print('setUpClass is set')
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

class TestWithTearDownClassMethod(unittest.TestCase):

    @classmethod
    def tearDownClass(cls):
        cls.tearDown_was_called = True

    def test_tear_down_class_was_not_called1_passed(self):
        self.assertFalse(hasattr(self, 'tearDown_was_called'))

    def test_tear_down_class_was_not_called2_passed(self):
        self.assertFalse(hasattr(self, 'tearDown_was_called'))
