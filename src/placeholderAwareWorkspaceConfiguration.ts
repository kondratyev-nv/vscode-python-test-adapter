import * as path from 'path';
import { WorkspaceFolder } from 'vscode';

import {
    IPytestConfiguration,
    IUnittestConfiguration,
    IWorkspaceConfiguration
} from './workspaceConfiguration';

export class PlaceholderAwareWorkspaceConfiguration implements IWorkspaceConfiguration {
    constructor(
        private readonly configuration: IWorkspaceConfiguration,
        public readonly workspaceFolder: WorkspaceFolder) {
    }

    public pythonPath(): string {
        const pythonPath = this.resolvePlaceholders(this.configuration.pythonPath());
        return path.isAbsolute(pythonPath) ? path.resolve(pythonPath) : pythonPath;
    }

    public getCwd(): string {
        const cwd = this.resolvePlaceholders(this.configuration.getCwd());
        return path.isAbsolute(cwd) ? path.resolve(cwd) : cwd;
    }

    public getUnittestConfiguration(): IUnittestConfiguration {
        const original = this.configuration.getUnittestConfiguration();
        const startDirectory = this.resolvePlaceholders(original.unittestArguments.startDirectory);

        return {
            isUnittestEnabled: original.isUnittestEnabled,
            unittestArguments: {
                pattern: this.resolvePlaceholders(original.unittestArguments.pattern),
                startDirectory: path.isAbsolute(startDirectory) ? path.resolve(startDirectory) : startDirectory,
            },
        };
    }

    public getPytestConfiguration(): IPytestConfiguration {
        const original = this.configuration.getPytestConfiguration();
        return {
            isPytestEnabled: original.isPytestEnabled,
            pytestArguments: original.pytestArguments.map(argument => this.resolvePlaceholders(argument)),
        };
    }

    private resolvePlaceholders(rawValue: string): string {
        const availableReplacements = new Map<string, string>();
        availableReplacements.set('workspaceFolder', this.workspaceFolder.uri.fsPath);
        Object.keys(process.env)
            .filter(key => process.env[key])
            .forEach(key => {
                availableReplacements.set(`env:${key}`, process.env[key]!);
            });

        const regexp = /\$\{(.*?)\}/g;
        return rawValue.replace(regexp, (match: string, name: string) => {
            return availableReplacements.get(name) || match;
        });
    }
}
