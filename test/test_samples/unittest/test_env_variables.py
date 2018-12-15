import os
import unittest


class EnvironmentVariablesTests(unittest.TestCase):

    def test_environment_variable_from_env_file_passed(self):
        self.assertTrue('SOME_FILE_VARIABLE' in os.environ)
        self.assertEqual(os.getenv('SOME_FILE_VARIABLE'), 'HelloFromEnvFile')


    def test_environment_variable_from_process_passed(self):
        self.assertTrue('SOME_PROCESS_VARIABLE' in os.environ)
        self.assertEqual(os.getenv('SOME_PROCESS_VARIABLE'), 'HelloFromProcessEnv')


    def test_pythonpath_from_process_passed(self):
        self.assertTrue('PYTHONPATH' in os.environ)
