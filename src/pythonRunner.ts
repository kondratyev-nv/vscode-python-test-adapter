import { IProcessExecution, IProcessRunConfiguration, runProcess } from './processRunner';

interface ICommonPythonRunConfiguration extends IProcessRunConfiguration {
    pythonPath: string;
    args?: string[];
}

class PythonProcessExecution implements IProcessExecution {
    public readonly pid: number;

    private readonly pythonProcess: IProcessExecution;

    constructor(args: string[], configuration: ICommonPythonRunConfiguration) {
        this.pythonProcess = runProcess(configuration.pythonPath, args, {
            ...configuration,
            environment: {
                ...configuration.environment,
                PYTHONUNBUFFERED: '1',
            },
        });
        this.pid = this.pythonProcess.pid;
    }

    public async complete(): Promise<{ exitCode: number; output: string }> {
        return this.pythonProcess.complete();
    }

    public cancel(): void {
        this.pythonProcess.cancel();
    }
}

function run(args: string[], configuration: ICommonPythonRunConfiguration): IProcessExecution {
    return new PythonProcessExecution(args, configuration);
}

export interface IPythonScriptRunConfiguration extends ICommonPythonRunConfiguration {
    script: string;
}

export interface IPythonModuleRunConfiguration extends ICommonPythonRunConfiguration {
    module: string;
}

export function runModule(configuration: IPythonModuleRunConfiguration): IProcessExecution {
    return run(['-m', configuration.module].concat(configuration.args || []), configuration);
}

export function runScript(configuration: IPythonScriptRunConfiguration): IProcessExecution {
    return run(['-c', configuration.script].concat(configuration.args || []), configuration);
}
