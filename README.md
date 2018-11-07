# Python Test Explorer for Visual Studio Code

[![Build Status](https://travis-ci.com/kondratyev-nv/vscode-python-test-adapter.svg?branch=master)](https://travis-ci.com/kondratyev-nv/vscode-python-test-adapter)

This extension allows you to run your Python [Unittest](https://docs.python.org/3/library/unittest.html#module-unittest) 
or [Pytest](https://docs.pytest.org/en/latest/)
tests with the [Test Explorer UI](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer).

![Screenshot](img/screenshot.png)

## Features
* Shows a Test Explorer in the Test view in VS Code's sidebar with all detected tests and suites and their state
* Shows a failed test's log when the test is selected in the explorer
* Supports multi-root workspaces

## Getting started
* Install the extension
* Configure Python extension for Visual Studio Code to discover your tests 
  (see [Configuration section](#configuration) and documentation of a test framework of your choice
  ([Unittest documentation](https://docs.python.org/3/library/unittest.html#module-unittest), 
   [Pytest](https://docs.pytest.org/en/latest/getting-started.html))
* Reload VS Code and open the Test view
* Run your tests using the ![Run](img/run-button.png) icon in the Test Explorer

## Configuration

By default the extension uses the configuration from [Python extension for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=ms-python.python).
To configure Python for your project see [Getting Started with Python in VS Code](https://code.visualstudio.com/docs/python/python-tutorial).

However, test framework used by this extension can be overridden by `pythonTestExplorer.testFramework` configuration property.
Right now, the two available option are `unittest` and `pytest`. When property is set to `null`, the configuration from Python extension is used.

List of currently used properties:

Property                          | Description
----------------------------------|---------------------------------------------------------------
`python.pythonPath`               | Path to Python
`python.unitTest.cwd`             | Optional working directory for unit tests
`python.unitTest.unittestEnabled` | Whether to enable or disable unit testing using unittest (enables or disables test discovery for Test Explorer)
`python.unitTest.unittestArgs`    | Arguments used for test discovery (currently only `-s` and `-p` arguments are considered)
`python.unitTest.pyTestEnabled` | Whether to enable or disable unit testing using pytest (enables or disables test discovery for Test Explorer)
`pythonTestExplorer.testFramework`| Test framework to use (overrides Python extension property `python.unitTest.unittestEnabled`)

## Questions, issues, feature requests, and contributions

* If you have any question or a problem with the extension, please [file an issue](https://github.com/kondratyev-nv/vscode-python-test-adapter/issues)
* Contributions are always welcome! Please see [contributing guide](CONTRIBUTING.md) for more details
