import { WorkspaceFolder, extensions } from 'vscode';
import { EOL } from 'os';

import { ILogger } from '../logging/logger';
import {
    IPytestConfiguration,
    IUnittestConfiguration,
    IWorkspaceConfiguration
} from './workspaceConfiguration';

export class PythonExtensionAwareWorkspaceConfiguration implements IWorkspaceConfiguration {
    private constructor(
        private readonly configuration: IWorkspaceConfiguration,
        public readonly workspaceFolder: WorkspaceFolder,
        private readonly detectedPythonPath?: string
    ) {

    }

    public static async for(
        configuration: IWorkspaceConfiguration,
        workspaceFolder: WorkspaceFolder,
        logger: ILogger
    ): Promise<PythonExtensionAwareWorkspaceConfiguration> {
        const detectedPythonPath = await PythonExtensionAwareWorkspaceConfiguration.detectPythonPath(
            workspaceFolder,
            logger
        );
        return new PythonExtensionAwareWorkspaceConfiguration(configuration, workspaceFolder, detectedPythonPath);
    }

    private static async detectPythonPath(
        workspaceFolder: WorkspaceFolder,
        logger: ILogger
    ): Promise<string | undefined> {
        try {
            return await PythonExtensionAwareWorkspaceConfiguration
                .tryDetectPythonPath(workspaceFolder, logger);
        } catch (error) {
            logger.log(
                'crit',
                `Failed to use pythonPath auto-detection from Python Extension: ${error}${EOL}${error.stack}`
            );
        }
        return undefined;
    }

    private static async tryDetectPythonPath(
        workspaceFolder: WorkspaceFolder,
        logger: ILogger
    ): Promise<string | undefined> {
        const extension = extensions.getExtension('ms-python.python')!;
        const usingNewInterpreterStorage = extension.packageJSON?.featureFlags?.usingNewInterpreterStorage;
        logger.log('debug', `usingNewInterpreterStorage feature flag is '${usingNewInterpreterStorage}'`);

        if (usingNewInterpreterStorage) {
            if (!extension.isActive) {
                await extension.activate();
            }
            await extension.exports.ready;

            const pythonPath = extension.exports.settings.getExecutionDetails(workspaceFolder.uri).execCommand[0];
            logger.log('info', `Using auto-detected pythonPath ${pythonPath}`);
            return pythonPath;
        }
        return undefined;
    }

    public pythonPath(): string {
        return this.detectedPythonPath || this.configuration.pythonPath();
    }

    public getCwd(): string {
        return this.configuration.getCwd();
    }

    public envFile(): string {
        return this.configuration.envFile();
    }

    public autoTestDiscoverOnSaveEnabled(): boolean {
        return this.configuration.autoTestDiscoverOnSaveEnabled();
    }

    public getUnittestConfiguration(): IUnittestConfiguration {
        return this.configuration.getUnittestConfiguration();
    }

    public getPytestConfiguration(): IPytestConfiguration {
        return this.configuration.getPytestConfiguration();
    }
}
