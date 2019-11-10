import subprocess

def call_node():
    proc = subprocess.run(
        ['node', '-e', 'console.log(123)'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=30)
    return proc.stdout

def test_my_code():
    out = call_node()
    assert out.decode("utf-8") == '123\n'
