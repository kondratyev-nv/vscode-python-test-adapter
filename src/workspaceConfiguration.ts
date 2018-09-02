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

    public parseUnitTestArguments(): IUnitTestArguments {
        const [known] = this.argumentParser.parseKnownArgs(this.configuration.get<string[]>('unittestArgs'));
        return known;
    }

    public getCwd(): string | undefined {
        return this.configuration.get<string>('cwd');
    }

    public isUnitTestEnabled(): boolean | undefined {
        return this.configuration.get<boolean>('unittestEnabled');
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
