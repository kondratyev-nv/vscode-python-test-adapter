
import { WorkspaceFolder } from 'vscode';

import { ILogger } from './logger';
import { ILogOutputChannel } from './logOutputChannel';

export class DefaultLogger implements ILogger {
    constructor(
        private readonly output: ILogOutputChannel,
        private readonly workspace: WorkspaceFolder
    ) { }

    public log(level: 'info' | 'warn' | 'crit' | 'debug', message: string): void {
        this.output.write(`${new Date().toISOString()} ${level} at '${this.workspace.name}': ${message}`);
    }
}
