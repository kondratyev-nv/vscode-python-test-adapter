import subprocess


def call_node():
    return subprocess.check_output(
        ['node', '-e', 'console.log("Hello world!")'])


def test_calling_external_process_passed():
    out = call_node()
    assert out.decode('utf-8') == 'Hello world!\n'
