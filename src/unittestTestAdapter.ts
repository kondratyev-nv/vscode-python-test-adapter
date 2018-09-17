import * as path from 'path';
import {
  TestEvent,
  TestInfo,
  TestSuiteInfo
} from 'vscode-test-adapter-api';

import { run } from './pythonRunner';
import { unittestHelperScript } from './unittestScripts';
import { parseTestStates, parseTestSuites } from './unittestSuitParser';
import { IWorkspaceConfiguration } from './workspaceConfiguration';

export class UnittestTestAdapter {
  constructor(
    public readonly adapterId: string
  ) { }

  public async load(config: IWorkspaceConfiguration): Promise<TestSuiteInfo | undefined> {
    if (!config.isUnitTestEnabled()) {
      return undefined;
    }
    const unittestArguments = config.parseUnitTestArguments();
    const output = await run({
      pythonPath: config.pythonPath(),
      script: unittestHelperScript(unittestArguments),
      args: ['discover'],
      cwd: config.getCwd(),
    });
    const suites = parseTestSuites(output, path.resolve(config.getCwd(), unittestArguments.startDirectory));
    return {
      type: 'suite',
      id: this.adapterId,
      label: 'All tests',
      children: suites,
    };
  }

  public async run(config: IWorkspaceConfiguration, info: TestSuiteInfo | TestInfo): Promise<TestEvent[]> {
    const output = await run({
      pythonPath: config.pythonPath(),
      script: unittestHelperScript(config.parseUnitTestArguments()),
      cwd: config.getCwd(),
      args: info.id !== this.adapterId ? ['run', info.id] : ['run'],
    });
    return parseTestStates(output);
  }
}
