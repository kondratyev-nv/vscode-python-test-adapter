
import { WorkspaceFolder } from 'vscode';

import { ILogger, LogLevel } from './logger';
import { ILogOutputChannel } from './logOutputChannel';

export class DefaultLogger implements ILogger {
    constructor(
        private readonly output: ILogOutputChannel,
        private readonly workspaceFolder: WorkspaceFolder,
        private readonly framework: string
    ) { }

    public log(level: LogLevel, message: string): void {
        try {
            this.output.write(
                `${new Date().toISOString()} ` +
                `${level} ` +
                `at '${this.workspaceFolder.name}' ` +
                `[${this.framework} runner]: ` +
                `${message}`
            );
        } catch {
            /* do nothing if cannot log */
        }
    }
}
