import { ArgumentParser } from 'argparse';
import { workspace, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';

import {
    IPytestConfiguration,
    ITestplanConfiguration,
    IUnittestArguments,
    IUnittestConfiguration,
    IWorkspaceConfiguration,
} from './workspaceConfiguration';

import { firstNotEmpty } from '../utilities/collections';

export class VscodeWorkspaceConfiguration implements IWorkspaceConfiguration {
    private readonly unittestArgumentParser: ArgumentParser;
    private readonly pythonConfiguration: WorkspaceConfiguration;
    private readonly testExplorerConfiguration: WorkspaceConfiguration;

    constructor(public readonly workspaceFolder: WorkspaceFolder) {
        this.unittestArgumentParser = this.configureUnittestArgumentParser();
        this.pythonConfiguration = this.getPythonConfiguration(workspaceFolder);
        this.testExplorerConfiguration = this.getTestExplorerConfiguration(workspaceFolder);
    }
    public pythonPath() {
        return this.pythonConfiguration.get<string>('pythonPath', 'python');
    }

    public getCwd(): string {
        return this.getConfigurationValueOrDefault(
            this.pythonConfiguration,
            ['unitTest.cwd', 'testing.cwd'],
            this.workspaceFolder.uri.fsPath
        );
    }

    public envFile(): string {
        return this.pythonConfiguration.get<string>('envFile', '${workspaceFolder}/.env');
    }

    public autoTestDiscoverOnSaveEnabled(): boolean {
        return this.pythonConfiguration.get<boolean>('testing.autoTestDiscoverOnSaveEnabled', true);
    }

    public getUnittestConfiguration(): IUnittestConfiguration {
        return {
            isUnittestEnabled: this.isUnitTestEnabled(),
            unittestArguments: this.getUnitTestArguments(),
        };
    }

    public getPytestConfiguration(): IPytestConfiguration {
        return {
            pytestPath: () => this.getPytestPath(),
            isPytestEnabled: this.isPytestTestEnabled(),
            pytestArguments: this.getPytestArguments(),
        };
    }

    public getTestplanConfiguration(): ITestplanConfiguration {
        return {
            testplanPath: () => this.getTestplanPath(),
            isTestplanEnabled: this.isTestplanTestEnabled(),
            testplanArguments: this.getTestplanArguments(),
        };
    }

    private getConfigurationValueOrDefault<T>(
        configuration: WorkspaceConfiguration,
        keys: string[],
        defaultValue: T
    ): T {
        return firstNotEmpty(
            keys.map((key) => () => configuration.get<T>(key)),
            defaultValue
        );
    }

    private isUnitTestEnabled(): boolean {
        const overriddenTestFramework = this.testExplorerConfiguration.get<string | null>('testFramework', null);
        if (overriddenTestFramework) {
            return 'unittest' === overriddenTestFramework;
        }
        return this.getConfigurationValueOrDefault(
            this.pythonConfiguration,
            ['unitTest.unittestEnabled', 'testing.unittestEnabled'],
            false
        );
    }

    private getUnitTestArguments(): IUnittestArguments {
        const [known] = this.unittestArgumentParser.parse_known_args(
            this.getConfigurationValueOrDefault(
                this.pythonConfiguration,
                ['unitTest.unittestArgs', 'testing.unittestArgs'],
                []
            )
        );
        return known;
    }

    private isPytestTestEnabled(): boolean {
        const overriddenTestFramework = this.testExplorerConfiguration.get<string | null>('testFramework', null);
        if (overriddenTestFramework) {
            return 'pytest' === overriddenTestFramework;
        }
        return this.getConfigurationValueOrDefault(
            this.pythonConfiguration,
            ['unitTest.pyTestEnabled', 'testing.pyTestEnabled', 'testing.pytestEnabled'],
            false
        );
    }

    private getPytestPath(): string {
        return this.getConfigurationValueOrDefault(
            this.pythonConfiguration,
            ['unitTest.pyTestPath', 'testing.pyTestPath', 'testing.pytestPath'],
            'pytest'
        );
    }

    private getPytestArguments(): string[] {
        return this.getConfigurationValueOrDefault(
            this.pythonConfiguration,
            ['unitTest.pyTestArgs', 'testing.pyTestArgs', 'testing.pytestArgs'],
            []
        );
    }

    private isTestplanTestEnabled(): boolean {
        const overriddenTestFramework = this.testExplorerConfiguration.get<string | null>('testFramework', null);
        if (overriddenTestFramework) {
            return 'testplan' === overriddenTestFramework;
        }
        return this.testExplorerConfiguration.get<boolean>('testplanEnabled', false);
    }

    private getTestplanPath(): string {
        return this.testExplorerConfiguration.get<string>('testplanPath', 'test_plan.py');
    }

    private getTestplanArguments(): string[] {
        return this.testExplorerConfiguration.get<string[]>('testplanArgs', []);
    }

    private configureUnittestArgumentParser() {
        const argumentParser = new ArgumentParser({
            exit_on_error: false,
        });
        argumentParser.add_argument('-p', '--pattern', {
            dest: 'pattern',
            default: 'test*.py',
        });
        argumentParser.add_argument('-s', '--start-directory', {
            dest: 'startDirectory',
            default: '.',
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
