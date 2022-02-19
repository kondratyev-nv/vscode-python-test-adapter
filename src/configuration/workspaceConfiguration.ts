export interface IUnittestArguments {
    startDirectory: string;
    pattern: string;
}

export interface IUnittestConfiguration {
    unittestArguments: IUnittestArguments;
    isUnittestEnabled: boolean;
}

export interface IPytestConfiguration {
    pytestPath(): string;
    pytestArguments: string[];
    isPytestEnabled: boolean;
}

export interface ITestplanConfiguration {
    testplanPath(): string;
    testplanArguments: string[];
    isTestplanEnabled: boolean;
}

export interface IBehaveConfiguration {
    behavePath(): string;
    behaveArguments: string[];
    isBehaveEnabled: boolean;
}

export interface IWorkspaceConfiguration {
    pythonPath(): string;

    getCwd(): string;

    envFile(): string;

    autoTestDiscoverOnSaveEnabled(): boolean;

    getUnittestConfiguration(): IUnittestConfiguration;

    getPytestConfiguration(): IPytestConfiguration;

    getTestplanConfiguration(): ITestplanConfiguration;

    getBehaveConfiguration(): IBehaveConfiguration;
}
