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
    testplanUseLegacyDiscovery: boolean;
    isTestplanEnabled: boolean;
}

export interface IWorkspaceConfiguration {
    pythonPath(): string;

    getCwd(): string;

    envFile(): string;

    autoTestDiscoverOnSaveEnabled(): boolean;

    collectOutputs(): boolean;

    showOutputsOnRun(): boolean;

    getUnittestConfiguration(): IUnittestConfiguration;

    getPytestConfiguration(): IPytestConfiguration;

    getTestplanConfiguration(): ITestplanConfiguration;
}
