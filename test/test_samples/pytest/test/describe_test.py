import pytest


def describe_list():

    @pytest.fixture
    def list():
        return []

    def describe_append():

        def adds_to_end_of_list_passed(list):
            list.append('foo')
            list.append('bar')
            assert list == ['foo', 'bar']

    def describe_remove():

        @pytest.fixture
        def list():
            return ['foo', 'bar']

        def removes_item_from_list_passed(list):
            list.remove('foo')
            assert list == ['bar']
