import * as process from 'child_process';
import * as iconv from 'iconv-lite';
import { EOL } from 'os';

export interface IPythonScriptRunConfiguration {
    pythonPath: string;
    script: string;
    cwd: string;
    args?: string[];
}

export async function run(configuration: IPythonScriptRunConfiguration): Promise<string> {
    return new Promise<string>(
        (resolve, reject) => {
            const discoveryProcess = process.spawn(
                configuration.pythonPath,
                ['-c', configuration.script].concat(configuration.args || []),
                {
                    cwd: configuration.cwd,
                    env: {
                        PYTHONUNBUFFERED: '1',
                    },
                });
            const stdoutBuffer: Buffer[] = [];
            const stderrBuffer: Buffer[] = [];
            discoveryProcess.stdout.on('data', chunk => stdoutBuffer.push(chunk));
            discoveryProcess.stderr.on('data', chunk => stderrBuffer.push(chunk));
            discoveryProcess.once('close', code => {
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
            discoveryProcess.once('error', error => {
                reject(`Error occurred during process execution: ${error}`);
            });
        }
    );
}

function decode(buffers: Buffer[]) {
    return iconv.decode(Buffer.concat(buffers), 'utf8');
}
