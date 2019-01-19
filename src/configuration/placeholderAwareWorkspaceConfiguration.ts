import * as path from 'path';
import { WorkspaceFolder } from 'vscode';

import { ILogger } from '../logging/logger';
import {
    IPytestConfiguration,
    IUnittestConfiguration,
    IWorkspaceConfiguration
} from './workspaceConfiguration';

export class PlaceholderAwareWorkspaceConfiguration implements IWorkspaceConfiguration {
    constructor(
        private readonly configuration: IWorkspaceConfiguration,
        public readonly workspaceFolder: WorkspaceFolder,
        private readonly logger: ILogger
    ) { }

    public pythonPath(): string {
        return this.resolve(this.configuration.pythonPath());
    }

    public getCwd(): string {
        return this.resolve(this.configuration.getCwd());
    }

    public envFile(): string {
        return this.resolve(this.configuration.envFile());
    }

    public getUnittestConfiguration(): IUnittestConfiguration {
        const original = this.configuration.getUnittestConfiguration();
        return {
            isUnittestEnabled: original.isUnittestEnabled,
            unittestArguments: {
                pattern: this.resolve(original.unittestArguments.pattern),
                startDirectory: this.resolvePlaceholders(original.unittestArguments.startDirectory),
            },
        };
    }

    public getPytestConfiguration(): IPytestConfiguration {
        const original = this.configuration.getPytestConfiguration();
        return {
            isPytestEnabled: original.isPytestEnabled,
            pytestArguments: original.pytestArguments.map(argument => this.resolve(argument)),
        };
    }

    private resolvePlaceholders(rawValue: string): string {
        const availableReplacements = new Map<string, string>();
        availableReplacements.set('workspaceFolder', this.workspaceFolder.uri.fsPath);
        availableReplacements.set('workspaceRoot', this.workspaceFolder.uri.fsPath);
        availableReplacements.set('workspaceFolderBasename', path.basename(this.workspaceFolder.uri.fsPath));
        availableReplacements.set('workspaceRootFolderName', path.basename(this.workspaceFolder.uri.fsPath));
        availableReplacements.set('cwd', this.workspaceFolder.uri.fsPath);
        Object.keys(process.env)
            .filter(key => process.env[key])
            .forEach(key => {
                availableReplacements.set(`env:${key}`, process.env[key]!);
            });

        const regexp = /\$\{(.*?)\}/g;
        return rawValue.replace(regexp, (match: string, name: string) => {
            const replacement = availableReplacements.get(name);
            if (replacement) {
                return replacement;
            }
            this.logger.log('warn', `Placeholder ${match} was not recognized and can not be replaced.`);
            return match;
        });
    }

    private resolve(rawValue: string): string {
        return this.resolvePath(this.resolvePlaceholders(rawValue));
    }

    private resolvePath(value: string): string {
        if (value.includes(path.posix.sep) || value.includes(path.win32.sep)) {
            const absolutePath = path.isAbsolute(value) ?
                path.resolve(value) :
                path.resolve(this.workspaceFolder.uri.fsPath, value);
            return path.normalize(absolutePath);
        }
        return value;
    }
}
