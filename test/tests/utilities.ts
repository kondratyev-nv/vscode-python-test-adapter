import { exec } from 'child_process';
import { getPythonExecutable } from '../utils/testConfiguration';
import { gte } from 'semver';


export function isTestplanPrerequisiteMet(): boolean {
    const command = getPythonExecutable() + ' --version';
    exec(command, (err, stdout) => {
        if (!err && stdout)
        {
            // stdout is "Python <major>.<minor>.<patch>"
            const version = stdout.split(' ')[1]
            return gte(version, '3.7');
        }
        return false;
      });
    return false;
}
