import { ArgumentParser } from 'argparse';
import { workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';

import {
    IPytestConfiguration,
    IUnittestArguments,
    IUnittestConfiguration,
    IWorkspaceConfiguration
} from './workspaceConfiguration';

export class VscodeWorkspaceConfiguration implements IWorkspaceConfiguration {
    private readonly argumentParser: ArgumentParser;
    private readonly pythonConfiguration: WorkspaceConfiguration;
    private readonly testExplorerConfiguration: WorkspaceConfiguration;

    constructor(public readonly workspaceFolder: WorkspaceFolder) {
        this.argumentParser = this.configureUnittestArgumentParser();
        this.pythonConfiguration = this.getPythonConfiguration(workspaceFolder);
        this.testExplorerConfiguration = this.getTestExplorerConfiguration(workspaceFolder);
    }

    public pythonPath() {
        return this.pythonConfiguration.get<string>('pythonPath', 'python');
    }

    public getCwd(): string {
        const unitTestCwd = this.pythonConfiguration.get<string>('unitTest.cwd');
        return unitTestCwd ?
            unitTestCwd :
            this.workspaceFolder.uri.fsPath;
    }

    public getUnittestConfiguration(): IUnittestConfiguration {
        return {
            isUnittestEnabled: this.isUnitTestEnabled(),
            unittestArguments: this.getUnitTestArguments(),
        };
    }

    public getPytestConfiguration(): IPytestConfiguration {
        return {
            isPytestEnabled: this.isPytestTestEnabled(),
            pytestArguments: [],
        };
    }

    private isUnitTestEnabled(): boolean {
        const overriddenTestFramework = this.testExplorerConfiguration.get<string | null>('testFramework', null);
        if (overriddenTestFramework) {
            return 'unittest' === overriddenTestFramework;
        }
        return this.pythonConfiguration.get<boolean>('unitTest.unittestEnabled', false);
    }

    private getUnitTestArguments(): IUnittestArguments {
        const [known] = this.argumentParser.parseKnownArgs(
            this.pythonConfiguration.get<string[]>('unitTest.unittestArgs', [])
        );
        return known;
    }

    private isPytestTestEnabled(): boolean {
        const overriddenTestFramework = this.testExplorerConfiguration.get<string | null>('testFramework', null);
        if (overriddenTestFramework) {
            return 'pytest' === overriddenTestFramework;
        }
        return this.pythonConfiguration.get<boolean>('unitTest.pyTestEnabled', false);
    }

    private configureUnittestArgumentParser() {
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
