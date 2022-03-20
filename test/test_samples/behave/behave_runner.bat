@echo off
echo "Hello from a script running behave"

python -m venv .some_venv

.some_venv\bin\activate
python -m pip install behave

behave %*
