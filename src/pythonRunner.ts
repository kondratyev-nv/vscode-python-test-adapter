import { ChildProcess, spawn } from 'child_process';
import * as iconv from 'iconv-lite';
import { EOL } from 'os';

interface ICommonPythonRunConfiguration {
    pythonPath: string;
    environment: { [key: string]: string | undefined };
    cwd?: string;
    args?: string[];
}

export interface IPythonScriptRunConfiguration extends ICommonPythonRunConfiguration {
    script: string;
}

export interface IPythonModuleRunConfiguration extends ICommonPythonRunConfiguration {
    module: string;
}

export interface IProcessExecution {
    pid: number;

    complete(): Promise<{ exitCode: number, output: string }>;

    cancel(): void;
}

class PythonProcessExecution implements IProcessExecution {
    public readonly pid: number;

    private readonly pythonProcess: ChildProcess;

    constructor(
        args: string[],
        configuration: IPythonModuleRunConfiguration | IPythonScriptRunConfiguration
    ) {
        this.pythonProcess = spawn(
            configuration.pythonPath,
            args,
            {
                cwd: configuration.cwd,
                env: {
                    ...process.env,
                    ...configuration.environment,
                    PYTHONUNBUFFERED: '1',
                },
            });
        this.pid = this.pythonProcess.pid;
    }
    public async complete(): Promise<{ exitCode: number; output: string; }> {
        return new Promise<{ exitCode: number, output: string }>((resolve, reject) => {
            const stdoutBuffer: Buffer[] = [];
            const stderrBuffer: Buffer[] = [];
            this.pythonProcess.stdout.on('data', chunk => stdoutBuffer.push(chunk));
            this.pythonProcess.stderr.on('data', chunk => stderrBuffer.push(chunk));

            this.pythonProcess.once('close', exitCode => {
                if (exitCode !== 0 && !this.pythonProcess.killed) {
                    reject(`Process exited with code ${exitCode}: ${decode(stderrBuffer)}`);
                }

                const output = decode(stdoutBuffer);
                if (!output) {
                    if (stdoutBuffer.length > 0) {
                        reject('Can not decode output from the process');
                    } else if (stderrBuffer.length > 0 && !this.pythonProcess.killed) {
                        reject(`Process returned an error:${EOL}${decode(stderrBuffer)}`);
                    }
                }
                resolve({ exitCode, output });
            });

            this.pythonProcess.once('error', error => {
                reject(`Error occurred during process execution: ${error}`);
            });
        });
    }
    public cancel(): void {
        this.pythonProcess.kill('SIGINT');
    }
}

function run(
    args: string[],
    configuration: IPythonModuleRunConfiguration | IPythonScriptRunConfiguration
): IProcessExecution {
    return new PythonProcessExecution(args, configuration);
}

export function runScript(configuration: IPythonScriptRunConfiguration): IProcessExecution {
    return run(['-c', configuration.script].concat(configuration.args || []), configuration);
}

function decode(buffers: Buffer[]) {
    return iconv.decode(Buffer.concat(buffers), 'utf8');
}
