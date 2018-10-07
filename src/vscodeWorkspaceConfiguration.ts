import { ArgumentParser } from 'argparse';
import * as path from 'path';
import { workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';

import { IUnitTestArguments, IWorkspaceConfiguration } from './workspaceConfiguration';

export class VscodeWorkspaceConfiguration implements IWorkspaceConfiguration {
    private readonly argumentParser: ArgumentParser;
    private readonly pythonConfiguration: WorkspaceConfiguration;
    private readonly testExplorerConfiguration: WorkspaceConfiguration;

    constructor(public readonly workspaceFolder: WorkspaceFolder) {
        this.argumentParser = this.configureArgumentParser();
        this.pythonConfiguration = this.getPythonConfiguration(workspaceFolder);
        this.testExplorerConfiguration = this.getTestExplorerConfiguration(workspaceFolder);
    }

    public pythonPath() {
        return this.pythonConfiguration.get<string>('pythonPath', 'python');
    }

    public parseUnitTestArguments(): IUnitTestArguments {
        const [known] = this.argumentParser.parseKnownArgs(
            this.pythonConfiguration.get<string[]>('unitTest.unittestArgs', [])
        );
        return known;
    }

    public getCwd(): string {
        const unitTestCwd = this.pythonConfiguration.get<string>('unitTest.cwd');
        return unitTestCwd ?
            path.resolve(this.workspaceFolder.uri.fsPath, unitTestCwd) :
            this.workspaceFolder.uri.fsPath;
    }

    public isUnitTestEnabled(): boolean {
        const overriddenTestFramework = this.testExplorerConfiguration.get<string | null>('testFramework', null);
        return 'unittest' === overriddenTestFramework ||
            this.pythonConfiguration.get<boolean>('unitTest.unittestEnabled', false);
    }

    private configureArgumentParser() {
        const argumentParser = new ArgumentParser();
        argumentParser.addArgument(['-p', '--pattern'], {
            dest: 'pattern',
            defaultValue: 'test*.py',
        });
        argumentParser.addArgument(['-s', '--start-directory'], {
            dest: 'startDirectory',
            defaultValue: '.',
        });
        return argumentParser;
    }

    private getConfigurationByName(name: string, workspaceFolder: WorkspaceFolder): WorkspaceConfiguration {
        return workspace.getConfiguration(name, workspaceFolder.uri);
    }

    private getPythonConfiguration(workspaceFolder: WorkspaceFolder): WorkspaceConfiguration {
        return this.getConfigurationByName('python', workspaceFolder);
    }

    private getTestExplorerConfiguration(workspaceFolder: WorkspaceFolder): WorkspaceConfiguration {
        return this.getConfigurationByName('pythonTestExplorer', workspaceFolder);
    }
}
