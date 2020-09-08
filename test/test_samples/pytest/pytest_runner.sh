#!/bin/bash

echo "Hello from a script running pytest"

python -m venv .some_venv

. .some_venv/bin/activate
python -m pip install pytest pytest-describe

pytest "$@"
