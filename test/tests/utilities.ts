import { exec } from 'child_process';
import { getPythonExecutable } from '../utils/testConfiguration';


export function isPython3(): boolean {
    const command = getPythonExecutable() + ' --version';
    exec(command, (err, stdout) => {
        if (!err)
        {
            // stdout is "Python <major>.<minor>.<patch>"
            const majorVersion = stdout.split(' ')[1].split('.')[0];
            return majorVersion === '3';
        }
        return false;
      });
    return false;
}
