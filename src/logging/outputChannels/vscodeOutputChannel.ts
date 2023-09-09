import { OutputChannel } from 'vscode';

import { ILogOutputChannel } from '../logOutputChannel';

export class VscodeOutputChannel implements ILogOutputChannel {
    constructor(private readonly channel: OutputChannel) {}
    public write(message: string): void {
        this.channel.appendLine(message);
    }
}
