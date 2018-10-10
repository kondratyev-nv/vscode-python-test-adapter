import pytest
import unittest


class Test_CheckMyApp:
    @unittest.skip("demonstrating skipping")
    def test_simple_check_skipped(self):
        pass

    def test_complex_check_passed(self):
        pass

    class Test_NestedClassB:
        class Test_nested_classC_Of_B:
            def test_e_passed(self):
                assert True

    class Test_NestedClassA:
        def test_nested_class_methodB_passed(self):
            assert True

        class Test_nested_classB_Of_A:
            def test_d_passed(self):
                assert True

        def test_nested_class_methodC_passed(self):
            assert True

    def test_simple_check2_passed(self):
        pass

    def test_complex_check2_passed(self):
        pass


@pytest.fixture
def parametrized_username():
    return 'overridden-username'


@pytest.fixture(params=['one', 'two', 'three'])
def non_parametrized_username(request):
    return request.param


def test_username_passed(parametrized_username):
    assert parametrized_username == 'overridden-username'


def test_parametrized_username_passed(non_parametrized_username):
    assert non_parametrized_username in ['one', 'two', 'three']
