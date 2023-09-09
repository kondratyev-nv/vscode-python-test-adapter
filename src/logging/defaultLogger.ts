import { WorkspaceFolder } from 'vscode';

import { ILogger, LogLevel } from './logger';
import { ILogOutputChannel } from './logOutputChannel';

export class DefaultLogger implements ILogger {
    constructor(
        private readonly output: ILogOutputChannel,
        private readonly workspaceFolder: WorkspaceFolder,
        private readonly framework: string
    ) {}

    public log(level: LogLevel, message: string): void {
        try {
            this.output.write(
                `${new Date().toISOString()} ` +
                    `${this.levelCode(level)} ` +
                    `${this.framework} at '${this.workspaceFolder.name}': ` +
                    `${message}`
            );
        } catch {
            /* do nothing if cannot log */
        }
    }

    private levelCode(level: LogLevel): string {
        switch (level) {
            case 'crit':
                return 'CRIT';
            case 'warn':
                return 'WARN';
            case 'info':
                return 'INFO';
            case 'debug':
                return ' DBG';
            default:
                return '?';
        }
    }
}
