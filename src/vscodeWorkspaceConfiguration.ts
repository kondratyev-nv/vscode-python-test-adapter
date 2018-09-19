import { ArgumentParser } from 'argparse';
import * as path from 'path';
import * as vscode from 'vscode';

import { IUnitTestArguments, IWorkspaceConfiguration } from './workspaceConfiguration';

export class VscodeWorkspaceConfiguration implements IWorkspaceConfiguration {
    private readonly argumentParser: ArgumentParser;
    private readonly configuration: vscode.WorkspaceConfiguration;

    constructor(public readonly workspaceFolder: vscode.WorkspaceFolder) {
        this.argumentParser = this.configureArgumentParser();
        this.configuration = this.getPythonConfiguration(workspaceFolder);
    }

    public pythonPath() {
        return this.configuration.get<string>('pythonPath', 'python');
    }

    public parseUnitTestArguments(): IUnitTestArguments {
        const [known] = this.argumentParser.parseKnownArgs(
            this.configuration.get<string[]>('unitTest.unittestArgs', [])
        );
        return known;
    }

    public getCwd(): string {
        const unitTestCwd = this.configuration.get<string>('unitTest.cwd');
        return unitTestCwd ?
            path.resolve(this.workspaceFolder.uri.fsPath, unitTestCwd) :
            this.workspaceFolder.uri.fsPath;
    }

    public isUnitTestEnabled(): boolean {
        return this.configuration.get<boolean>('unitTest.unittestEnabled', false);
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

    private getPythonConfiguration(workspaceFolder: vscode.WorkspaceFolder): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(
            'python',
            workspaceFolder.uri
        );
    }
}
