import * as process from 'child_process';
import * as iconv from 'iconv-lite';

export interface IPythonScriptRunConfiguration {
    script: string;
    cwd: string;
    args?: string[];
}

export async function run(configuration: IPythonScriptRunConfiguration): Promise<string> {
    return new Promise<string>(
        (resolve, reject) => {
            const discoveryProcess = process.spawn(
                'python3',
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
                    const error = iconv.decode(Buffer.concat(stderrBuffer), 'utf8');
                    reject(`Process exited with code ${code}: ${error}`);
                }

                const output = iconv.decode(Buffer.concat(stdoutBuffer), 'utf8');
                if (!output) {
                    reject('Can not decode output from the process');
                }
                resolve(output);
            });
            discoveryProcess.once('error', error => {
                reject(`Error occurred during process execution: ${error}`);
            });
        }
    );
}
