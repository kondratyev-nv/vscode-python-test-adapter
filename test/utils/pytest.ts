export const PYTEST_EXPECTED_SUITES_LIST_WITHOUT_ERRORS = [
    'arithmetic.py',
    'describe_test.py',
    'env_variables_test.py',
    'fixture_test.py',
    'generate_test.py',
    'inner_fixture_test.py',
    'string_test.py',
    'subprocess_test.py',
    'add_test.py',
    'add_test.py',
    'test_simple.py',
];

export const PYTEST_EXPECTED_SUITES_LIST_WITH_ERRORS = [
    {
        label: 'describe_test.py',
        description: undefined,
    },
    {
        label: 'env_variables_test.py',
        description: undefined,
    },
    {
        label: 'fixture_test.py',
        description: undefined,
    },
    {
        label: 'generate_test.py',
        description: undefined,
    },
    {
        label: 'inner_fixture_test.py',
        description: undefined,
    },
    {
        label: 'string_test.py',
        description: undefined,
    },
    {
        label: 'subprocess_test.py',
        description: undefined,
    },
    {
        label: 'add_test.py',
        description: 'inner_tests',
    },
    {
        label: 'add_test.py',
        description: 'other_tests',
    },
    {
        label: 'test_simple.py',
        description: undefined,
    },
    {
        label: 'Error in invalid_syntax_test.py',
        description: undefined,
    },
    {
        label: 'Error in non_existing_module_test.py',
        description: undefined,
    },
];
