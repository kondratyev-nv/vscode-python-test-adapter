import * as path from 'path';
import * as vscode from 'vscode';
import {
  TestEvent,
  TestInfo,
  TestSuiteInfo
} from 'vscode-test-adapter-api';

import { run } from './pythonRunner';
import { unittestHelperScript } from './unittestScripts';
import { parseTestStates, parseTestSuits } from './unittestSuitParser';
import { WorkspaceConfiguration } from './workspaceConfiguration';

export class UnittestTestAdapter {
  constructor(
    public readonly adapterId: string,
    private readonly workspaceFolder: vscode.WorkspaceFolder
  ) { }

  public async load(): Promise<TestSuiteInfo | undefined> {
    const config = new WorkspaceConfiguration(this.getDefaultPythonConfiguration());
    if (!config.isUnitTestEnabled()) {
      return undefined;
    }
    const unittestArguments = config.parseUnitTestArguments();
    const output = await run({
      pythonPath: config.pythonPath(),
      script: unittestHelperScript(unittestArguments),
      args: ['discover'],
      cwd: this.getCwd(config),
    });
    const suites = parseTestSuits(output, path.resolve(this.getCwd(config), unittestArguments.startDirectory));
    return {
      type: 'suite',
      id: this.adapterId,
      label: 'All tests',
      children: suites,
    };
  }

  public async run(info: TestSuiteInfo | TestInfo): Promise<TestEvent[]> {
    const config = new WorkspaceConfiguration(this.getDefaultPythonConfiguration());
    const output = await run({
      pythonPath: config.pythonPath(),
      script: unittestHelperScript(config.parseUnitTestArguments()),
      cwd: this.getCwd(config),
      args: info.id !== this.adapterId ? ['run', info.id] : ['run'],
    });
    return parseTestStates(output);
  }

  private getDefaultPythonConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(
      'python',
      this.workspaceFolder.uri
    );
  }

  private getCwd(configuration: WorkspaceConfiguration) {
    return configuration.getCwd() ?
      path.resolve(this.workspaceFolder.uri.fsPath, configuration.getCwd()!) :
      this.workspaceFolder.uri.fsPath;
  }
}
