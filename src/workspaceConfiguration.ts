export interface IUnitTestArguments {
    startDirectory: string;
    pattern: string;
}

export interface IWorkspaceConfiguration {
    pythonPath(): string;

    parseUnitTestArguments(): IUnitTestArguments;

    getCwd(): string;

    isUnitTestEnabled(): boolean;
}
