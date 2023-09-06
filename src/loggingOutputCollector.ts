import { OutputChannel } from 'vscode';
import { IProcessOutputCollector } from './processRunner';
import { ChildProcess } from 'child_process';

export class LoggingOutputCollector implements IProcessOutputCollector {
    constructor(private outputChannel: OutputChannel) {}
    attach(process: ChildProcess): void {
        process.stderr?.on('data', (chunk) => this.write(`${chunk}`));
        process.stdout?.on('data', (chunk) => this.write(`${chunk}`));
    }

    private write(message: string): void {
        this.outputChannel.append(message);
    }
}
