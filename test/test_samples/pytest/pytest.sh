echo "Hello from a script running pytest"

python3 -m venv .some_venv

. .some_venv/bin/activate
python3 -m pip install pytest pytest-describe

pytest "$@"
