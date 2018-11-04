## Contributing a pull request

### Prerequisites

1. Node.js (>= 8.10.0)
2. Python 2.7 __and__ Python >= 3.4 (required only for testing the extension and running tests)
3. Windows, macOS, or Linux
4. Visual Studio Code

### Setup

```shell
git clone https://github.com/kondratyev-nv/vscode-python-test-adapter
cd vscode-python-test-adapter
npm install
```

To run tests you will also need additional python modules to be installed
```shell
python -m pip install --user --upgrade -r requirements.txt
python3 -m pip install --user --upgrade -r requirements.txt
```

### Incremental Build

Run the `Build` tasks from the [Command Palette](https://code.visualstudio.com/docs/editor/tasks) (short cut `CTRL+SHIFT+B` or `⇧⌘B`)

You can also compile from the command-line:

```shell
npm run build
```

### Errors and Warnings

TypeScript errors and warnings will be displayed in the `Problems` window of Visual Studio Code.

### Validate your changes

To test the changes, launch a development version of VS Code using the `Run extension` launch option.

To run tests, run `Extension tests` launch option. It will execute integration tests for **both** Python 2 and Python 3, thus `python` and `python3` commands should be available to run and `pytest` module should be importable. Results of the tests are shown in Debug Console.
