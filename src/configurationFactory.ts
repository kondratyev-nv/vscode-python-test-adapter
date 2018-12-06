import { WorkspaceFolder } from 'vscode';

import { ILogger } from './logging/logger';
import { PlaceholderAwareWorkspaceConfiguration } from './placeholderAwareWorkspaceConfiguration';
import { VscodeWorkspaceConfiguration } from './vscodeWorkspaceConfiguration';
import { IPytestConfiguration, IUnittestConfiguration, IWorkspaceConfiguration } from './workspaceConfiguration';

export class ConfigurationFactory {
    public static get(workspaceFolder: WorkspaceFolder, logger: ILogger): IWorkspaceConfiguration {
        logger.log('info', `Reading configuration for workspace ${workspaceFolder.name}`);
        const configuration = new PlaceholderAwareWorkspaceConfiguration(
            new VscodeWorkspaceConfiguration(workspaceFolder),
            workspaceFolder
        );
        return {
            pythonPath(): string {
                const pythonPath = configuration.pythonPath();
                logger.log('info', `Python path resolved to ${pythonPath}`);
                return pythonPath;
            },

            getCwd(): string {
                const cwd = configuration.getCwd();
                logger.log('info', `Working directory resolved to ${cwd}`);
                return cwd;
            },

            getUnittestConfiguration(): IUnittestConfiguration {
                const unittestConfiguration = configuration.getUnittestConfiguration();
                return unittestConfiguration;
            },

            getPytestConfiguration(): IPytestConfiguration {
                const pytestConfiguration = configuration.getPytestConfiguration();
                return pytestConfiguration;
            },
        };
    }
}
