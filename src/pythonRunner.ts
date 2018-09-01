import * as process from 'child_process';
import * as iconv from 'iconv-lite'

export async function run(script: string, cwd: string, args?: string[]): Promise<string> {
    return new Promise<string>(
        (resolve, reject) => {
            const discoveryProcess = process.spawn(
                "python3",
                ["-c", script].concat(args || []),
                {
                    cwd: cwd,
                    env: {
                        PYTHONUNBUFFERED: '1'
                    }
                });
            const stdoutBuffer: Buffer[] = [];
            const stderrBuffer: Buffer[] = [];
            discoveryProcess.stdout.on("data", chunk => stdoutBuffer.push(chunk));
            discoveryProcess.stderr.on("data", chunk => stderrBuffer.push(chunk));
            discoveryProcess.once("close", (code, signal) => {
                if (code != 0) {
                    const error = iconv.decode(Buffer.concat(stderrBuffer), 'utf8');
                    reject(`Process exited with code ${code}: ${error}`);
                }

                const output = iconv.decode(Buffer.concat(stdoutBuffer), 'utf8');
                if (!output) {
                    reject(`Can not decode output from the process`);
                }
                resolve(output);
            });
            discoveryProcess.once("error", error => {
                reject(`Error occurred during process execution: ${error}`);
            });
        }
    );
}
