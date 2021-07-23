import { exec } from 'child_process';
import util = require('util');
export const execPromise = util.promisify(exec);
import { getPythonExecutable } from '../utils/testConfiguration';
import { gte } from 'semver';


export async function isTestplanPrerequisiteMet(): Promise<boolean> {
    const command = getPythonExecutable() + ' --version';
    const result = await execPromise(command);
    if (!result.stderr && result.stdout)
    {
        // stdout is "Python <major>.<minor>.<patch>"
        const version = result.stdout.split(' ')[1]
        return gte(version, '3.7.0');
    }
    return false;
}
