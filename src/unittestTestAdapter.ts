import * as path from 'path';
import * as vscode from 'vscode';
import {
  TestAdapter,
  TestEvent,
  TestInfo,
  TestSuiteEvent,
  TestSuiteInfo
} from 'vscode-test-adapter-api';

import { run } from './pythonRunner';
import { unittestHelperScript } from './pythonScripts';
import { ALL_TESTS_SUIT_ID, parseTestStates, parseTestSuits } from './unittestSuitParser';
import { WorkspaceConfiguration } from './workspaceConfiguration';

export class UnittestTestAdapter implements TestAdapter {
  private readonly testStatesEmitter = new vscode.EventEmitter<TestSuiteEvent | TestEvent>();
  private readonly reloadEmitter = new vscode.EventEmitter<void>();
  private readonly autorunEmitter = new vscode.EventEmitter<void>();

  constructor(public readonly workspaceFolder: vscode.WorkspaceFolder) { }

  get testStates(): vscode.Event<TestSuiteEvent | TestEvent> {
    return this.testStatesEmitter.event;
  }

  get reload(): vscode.Event<void> {
    return this.reloadEmitter.event;
  }

  get autorun(): vscode.Event<void> {
    return this.autorunEmitter.event;
  }

  public load(): Promise<TestSuiteInfo | undefined> {
    const config = new WorkspaceConfiguration(this.getDefaultPythonConfiguration());
    return new Promise<TestSuiteInfo | undefined>((resolve, reject) => {
      if (!config.isUnitTestEnabled()) {
        return resolve();
      }
      const unittestArguments = config.parseUnitTestArguments();
      return run({
        pythonPath: config.pythonPath(),
        script: unittestHelperScript(unittestArguments),
        args: ['discover'],
        cwd: this.getCwd(config),
      })
        .then(output =>
          resolve(parseTestSuits(output, this.workspaceFolder.uri.fsPath))
        )
        .catch(reason => reject(reason));
    });
  }

  public run(info: TestSuiteInfo | TestInfo): Promise<void> {
    const config = new WorkspaceConfiguration(this.getDefaultPythonConfiguration());
    return run({
      pythonPath: config.pythonPath(),
      script: unittestHelperScript(config.parseUnitTestArguments()),
      cwd: this.getCwd(config),
      args: info.id !== ALL_TESTS_SUIT_ID ? ['run', info.id] : ['run'],
    })
      .then(output => parseTestStates(output).forEach(state => this.testStatesEmitter.fire(state)))
      .catch(reason => this.setTestStatesRecursive(info, 'failed', reason));
  }

  public debug(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public cancel(): void {
    throw new Error('Method not implemented.');
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

  private setTestStatesRecursive(
    info: TestSuiteInfo | TestInfo,
    state: 'running' | 'passed' | 'failed' | 'skipped',
    message?: string | undefined
  ) {
    if (info.type === 'suite') {
      info.children.forEach(child =>
        this.setTestStatesRecursive(child, state, message)
      );
    } else {
      this.testStatesEmitter.fire(<TestEvent>{
        type: 'test',
        test: info.id,
        state,
        message,
      });
    }
  }
}
