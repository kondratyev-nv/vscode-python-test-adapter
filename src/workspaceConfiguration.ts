import { ArgumentParser } from 'argparse';
import * as vscode from 'vscode';

export interface IUnitTestArguments {
    startDirectory: string;
    pattern: string;
}

export class WorkspaceConfiguration {
    private readonly argumentParser: ArgumentParser;

    constructor(private readonly configuration: vscode.WorkspaceConfiguration) {
        this.argumentParser = this.configureArgumentParser();
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

    public getCwd(): string | undefined {
        return this.configuration.get<string>('unitTest.cwd');
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
}
