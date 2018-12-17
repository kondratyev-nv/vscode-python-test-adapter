export interface IUnittestArguments {
    startDirectory: string;
    pattern: string;
}

export interface IUnittestConfiguration {
    unittestArguments: IUnittestArguments;
    isUnittestEnabled: boolean;
}

export interface IPytestConfiguration {
    pytestArguments: string[];
    isPytestEnabled: boolean;
}

export interface IWorkspaceConfiguration {
    pythonPath(): string;

    getCwd(): string;

    envFile(): string;

    getUnittestConfiguration(): IUnittestConfiguration;

    getPytestConfiguration(): IPytestConfiguration;
}
