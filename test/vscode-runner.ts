
import { runTests } from 'vscode-test';
import { getPythonExecutable } from './utils/testConfiguration';
import { runScript } from '../src/pythonRunner';
import * as path from 'path';

async function main() {
  try {
    const python = getPythonExecutable();
    console.log(`Python executable is ${python}`);
    await runScript({
      script: 'from __future__ import print_function; import sys; print(sys.executable, sys.version)',
      pythonPath: python,
      environment: {},
    }).complete().then(({ output }) => console.log(`Using python ${output}`));

    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './mocha-runner');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        path.resolve(extensionDevelopmentPath, 'test/test_samples/samples-workspace.code-workspace')
      ],
    });
  } catch (error) {
    console.error(error);
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
