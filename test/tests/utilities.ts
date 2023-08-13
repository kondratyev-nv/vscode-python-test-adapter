import { exec } from 'child_process';
import * as util from 'util';
import { getPythonExecutable } from '../utils/testConfiguration';
import { gte } from 'semver';

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
