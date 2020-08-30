import { ChildProcess, spawn } from 'child_process';
import * as iconv from 'iconv-lite';
import { EOL } from 'os';

export interface IProcessRunConfiguration {
    executable: string;
    environment: { [key: string]: string | undefined };
    cwd?: string;
}

export interface IProcessExecution {
    pid: number;

    complete(): Promise<{ exitCode: number, output: string }>;

    cancel(): void;
}

class CommandProcessExecution implements IProcessExecution {
    public readonly pid: number;

    private readonly commandProcess: ChildProcess;

    constructor(
        args: string[],
        configuration: IProcessRunConfiguration
    ) {
        this.commandProcess = spawn(
            configuration.executable,
            args,
            {
                cwd: configuration.cwd,
                env: {
                    ...process.env,
                    ...configuration.environment
                },
            });
        this.pid = this.commandProcess.pid;
    }
    public async complete(): Promise<{ exitCode: number; output: string; }> {
        return new Promise<{ exitCode: number, output: string }>((resolve, reject) => {
            const stdoutBuffer: Buffer[] = [];
            const stderrBuffer: Buffer[] = [];
            this.commandProcess.stdout!.on('data', chunk => stdoutBuffer.push(chunk));
            this.commandProcess.stderr!.on('data', chunk => stderrBuffer.push(chunk));

            this.commandProcess.once('close', exitCode => {
                if (exitCode !== 0 && !this.commandProcess.killed) {
                    reject(`Process exited with code ${exitCode}: ${decode(stderrBuffer)}`);
                }

                const output = decode(stdoutBuffer);
                if (!output) {
                    if (stdoutBuffer.length > 0) {
                        reject('Can not decode output from the process');
                    } else if (stderrBuffer.length > 0 && !this.commandProcess.killed) {
                        reject(`Process returned an error:${EOL}${decode(stderrBuffer)}`);
                    }
                }
                resolve({ exitCode, output });
            });

            this.commandProcess.once('error', error => {
                reject(`Error occurred during process execution: ${error}`);
            });
        });
    }
    public cancel(): void {
        this.commandProcess.kill('SIGINT');
    }
}

export function runProcess(
    args: string[],
    configuration: IProcessRunConfiguration
): IProcessExecution {
    return new CommandProcessExecution(args, configuration);
}

function decode(buffers: Buffer[]) {
    return iconv.decode(Buffer.concat(buffers), 'utf8');
}
