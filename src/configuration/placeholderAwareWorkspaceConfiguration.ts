import * as path from 'path';
import untildify from 'untildify';
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
        return this.resolveExecutablePath(this.configuration.pythonPath());
    }

    public getCwd(): string {
        return this.resolvePath(this.configuration.getCwd());
    }

    public envFile(): string {
        return this.resolvePath(this.configuration.envFile());
    }

    public getUnittestConfiguration(): IUnittestConfiguration {
        const original = this.configuration.getUnittestConfiguration();
        return {
            isUnittestEnabled: original.isUnittestEnabled,
            unittestArguments: {
                pattern: this.resolvePlaceholders(original.unittestArguments.pattern),
                startDirectory: this.resolvePath(original.unittestArguments.startDirectory),
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

    private resolveExecutablePath(rawValue: string): string {
        return this.normalizeExecutablePath(this.resolvePlaceholders(rawValue));
    }

    private resolvePath(rawValue: string): string {
        return this.normalizePath(this.resolvePlaceholders(rawValue));
    }

    // Executable can be in multiple formats:
    //  1. 'command' - globally available executable (path to the file in is in PATH)
    //  2. './command' - relative path to the workspace folder
    //  3. '/bin/command' - absolute path
    private normalizeExecutablePath(originalValue: string): string {
        const value = untildify(originalValue);
        if (value.includes(path.posix.sep) || value.includes(path.win32.sep)) {
            const absolutePath = path.isAbsolute(value) ?
                path.resolve(value) :
                path.resolve(this.workspaceFolder.uri.fsPath, value);
            return path.normalize(absolutePath);
        }
        return value;
    }

    // Path to a file can be in multiple formats:
    //  1. './file' - relative path to the workspace folder
    //  2. '/some/path/file' - absolute path
    // We do not consider 'file' as a valid path.
    // For example, path in format as 'path' can not be used as a cwd in spawn,
    // see https://github.com/kondratyev-nv/vscode-python-test-adapter/issues/158
    private normalizePath(originalValue: string): string {
        const value = untildify(originalValue);
        const absolutePath = path.isAbsolute(value) ?
            path.resolve(value) :
            path.resolve(this.workspaceFolder.uri.fsPath, value);
        return path.normalize(absolutePath);
    }
}
