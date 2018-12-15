import { spawn } from 'child_process';
import * as iconv from 'iconv-lite';
import { EOL } from 'os';

export interface IPythonScriptRunConfiguration {
    pythonPath: string;
    script: string;
    cwd: string;
    args?: string[];
}

export interface IPythonModuleRunConfiguration {
    pythonPath: string;
    module: string;
    cwd: string;
    args?: string[];
}

async function run(
    args: string[],
    configuration: IPythonModuleRunConfiguration | IPythonScriptRunConfiguration
): Promise<string> {

    return new Promise<string>((resolve, reject) => {
        const pythonProcess = spawn(
            configuration.pythonPath,
            args,
            {
                cwd: configuration.cwd,
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: '1',
                },
            });
        const stdoutBuffer: Buffer[] = [];
        const stderrBuffer: Buffer[] = [];
        pythonProcess.stdout.on('data', chunk => stdoutBuffer.push(chunk));
        pythonProcess.stderr.on('data', chunk => stderrBuffer.push(chunk));
        pythonProcess.once('close', code => {
            if (code !== 0) {
                reject(`Process exited with code ${code}: ${decode(stderrBuffer)}`);
            }

            const output = decode(stdoutBuffer);
            if (!output) {
                if (stdoutBuffer.length > 0) {
                    reject('Can not decode output from the process');
                } else {
                    reject(`Process returned an error:${EOL}${decode(stderrBuffer)}`);
                }
            }
            resolve(output);
        });
        pythonProcess.once('error', error => {
            reject(`Error occurred during process execution: ${error}`);
        });
    });
}

export async function runModule(configuration: IPythonModuleRunConfiguration): Promise<string> {
    return await run(['-m', configuration.module].concat(configuration.args || []), configuration);
}

export async function runScript(configuration: IPythonScriptRunConfiguration): Promise<string> {
    return await run(['-c', configuration.script].concat(configuration.args || []), configuration);
}

function decode(buffers: Buffer[]) {
    return iconv.decode(Buffer.concat(buffers), 'utf8');
}
