import * as vscode from 'vscode';
import {
  TestAdapter,
  TestEvent,
  TestInfo,
  TestSuiteEvent,
  TestSuiteInfo
} from 'vscode-test-adapter-api';

import { UnittestTestAdapter } from './unittestTestAdapter';
import { VscodeWorkspaceConfiguration } from './vscodeWorkspaceConfiguration';

export class PythonTestAdapter implements TestAdapter {
  private readonly testStatesEmitter = new vscode.EventEmitter<TestSuiteEvent | TestEvent>();
  private readonly reloadEmitter = new vscode.EventEmitter<void>();
  private readonly autorunEmitter = new vscode.EventEmitter<void>();

  constructor(
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    private readonly testAdapter: UnittestTestAdapter
  ) { }

  get testStates(): vscode.Event<TestSuiteEvent | TestEvent> {
    return this.testStatesEmitter.event;
  }

  get reload(): vscode.Event<void> {
    return this.reloadEmitter.event;
  }

  get autorun(): vscode.Event<void> {
    return this.autorunEmitter.event;
  }

  public async load(): Promise<TestSuiteInfo | undefined> {
    const config = new VscodeWorkspaceConfiguration(this.workspaceFolder);
    return await this.testAdapter.load(config);
  }

  public async run(info: TestSuiteInfo | TestInfo): Promise<void> {
    const config = new VscodeWorkspaceConfiguration(this.workspaceFolder);
    return this.testAdapter.run(config, info)
      .then(states => states.forEach(state => this.testStatesEmitter.fire(state)))
      .catch(reason => this.setTestStatesRecursive(info, 'failed', reason));
  }

  public debug(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public cancel(): void {
    throw new Error('Method not implemented.');
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
