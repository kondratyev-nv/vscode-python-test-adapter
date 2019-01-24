import time
import unittest


class SleepTestCase(unittest.TestCase):
    def test_before_sleep_passed(self):
        pass
    
    def test_sleep(self):
        time.sleep(20) # should be more than test timeout
