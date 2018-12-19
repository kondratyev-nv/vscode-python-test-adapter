## Building and testing extension

### Prerequisites

1. Node.js (>= 8.10.0)
1. Python 2.7 or Python >= 3.4 (required only for testing the extension and running tests)
1. Windows, macOS, or Linux
1. Visual Studio Code

### Setup

```shell
git clone https://github.com/kondratyev-nv/vscode-python-test-adapter
cd vscode-python-test-adapter
npm install
```

To run tests you will also need additional python modules to be installed
```shell
python -m pip install --upgrade -r requirements.txt
```

### Build

Run the `Build` tasks from the [Command Palette](https://code.visualstudio.com/docs/editor/tasks) (short cut `CTRL+SHIFT+B` or `⇧⌘B`)

You can also compile from the command-line:

```shell
npm run build
```

### Errors and Warnings

TypeScript errors and warnings will be displayed in the `Problems` window of Visual Studio Code.

### Validate your changes

To test the changes, launch a development version of VS Code using the `Run extension` launch option.

To run tests, run `Extension tests` launch option. It will execute integration tests for Python that is used by default in the environment using `python` command. Since this `pytest` module should be importable. Results of the tests are shown in Debug Console.

To run your tests against multiple python versions the [Tox](https://tox.readthedocs.io/en/latest/) can be used. The following commands will install Tox module, then run tests using virtual environments `py27` and `py36`. 

```shell
python -m pip install tox
python -m tox
```

To ensure python version that is used in tests look for a similar line in the test output

```
Using python /usr/bin/python 2.7.15rc1
```
