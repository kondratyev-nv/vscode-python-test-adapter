import { ChildProcess, exec } from 'child_process';
import * as util from 'util';
import { getPythonExecutable } from '../utils/testConfiguration';
import { gte } from 'semver';
import { IProcessOutputCollector } from '../../src/processRunner';

export const execPromise = util.promisify(exec);
export async function isTestplanPrerequisiteMet(): Promise<boolean> {
    const command = getPythonExecutable() + ' --version';
    const result = await execPromise(command);
    if (!result.stderr && result.stdout) {
        // stdout is "Python <major>.<minor>.<patch>"
        const version = result.stdout.split(' ')[1];
        return gte(version, '3.7.0');
    }
    return false;
}

export class TestOutputCollector implements IProcessOutputCollector {
    public output: string = '';

    attach(process: ChildProcess): void {
        process.stdout?.on('data', (chunk) => {
            this.output += chunk.toString();
        });
    }
}
