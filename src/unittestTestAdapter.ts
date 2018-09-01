import * as vscode from "vscode";
import {
  TestAdapter,
  TestEvent,
  TestInfo,
  TestSuiteEvent,
  TestSuiteInfo
} from "vscode-test-adapter-api";
import { Base64 } from 'js-base64';

import { ALL_TESTS_SUIT_ID, parseTestSuits } from "./unittestSuitParser";
import { DISCOVER_TESTS_SCRIPT, RUN_TEST_SUIT_SCRIPT } from "./pythonScripts";
import { run } from "./pythonRunner";

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

  load(): Promise<TestSuiteInfo | undefined> {
    const config = this.getDefaultUnittestConfiguration();
    return new Promise<TestSuiteInfo | undefined>((resolve, reject) => {
      const isEnabled = this.getEnabledState(config);
      if (!isEnabled) {
        return resolve();
      }
      return run(DISCOVER_TESTS_SCRIPT, this.workspaceFolder.uri.fsPath)
        .then(output =>
          resolve(parseTestSuits(output, this.workspaceFolder.uri.fsPath))
        )
        .catch(reason => reject(reason));
    });
  }

  run(info: TestSuiteInfo | TestInfo): Promise<void> {
    return run(RUN_TEST_SUIT_SCRIPT, this.workspaceFolder.uri.fsPath, info.id != ALL_TESTS_SUIT_ID ? [info.id] : [])
      .then(output => {
        this.updateTestsState(output);
      })
      .catch(reason => this.setTestStatesRecursive(info, 'failed', reason));
  }

  debug(info: TestSuiteInfo | TestInfo): Promise<void> {
    throw new Error("Method not implemented.");
  }

  cancel(): void {
    throw new Error("Method not implemented.");
  }

  private getDefaultUnittestConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(
      "python.unitTest",
      this.workspaceFolder.uri
    );
  }

  private updateTestsState(output: string): void {
    output
      .split(/\r?\n/g)
      .map(line => line.trim())
      .filter(line => line)
      .map(line => {
        const [result, testId, base64Message = ''] = line.split(":");
        this.testStatesEmitter.fire(<TestEvent>{
          type: "test",
          test: testId.trim(),
          state: result.trim(),
          message: base64Message ? Base64.decode(base64Message.trim()) : undefined
        });
      });
  }

  // private getUnittestArgs(
  //   config: vscode.WorkspaceConfiguration
  // ): string[] | undefined {
  //   return config.get<string[]>("unittestArgs");
  // }

  private getEnabledState(
    config: vscode.WorkspaceConfiguration
  ): boolean | undefined {
    return config.get<boolean>("unittestEnabled");
  }

  private setTestStatesRecursive(
    info: TestSuiteInfo | TestInfo,
    state: "running" | "passed" | "failed" | "skipped",
    message?: string | undefined
  ) {
    if (info.type == "suite") {
      info.children.forEach(child =>
        this.setTestStatesRecursive(child, state, message)
      );
    } else {
      this.testStatesEmitter.fire(<TestEvent>{
        type: "test",
        test: info.id,
        state: state,
        message: message
      });
    }
  }
}
