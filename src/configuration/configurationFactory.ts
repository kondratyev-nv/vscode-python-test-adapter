import { WorkspaceFolder } from 'vscode';

import { ILogger } from '../logging/logger';
import { PlaceholderAwareWorkspaceConfiguration } from './placeholderAwareWorkspaceConfiguration';
import { PythonExtensionAwareWorkspaceConfiguration } from './pythonExtensionAwareWorkspaceConfiguration';
import { VscodeWorkspaceConfiguration } from './vscodeWorkspaceConfiguration';
import { IWorkspaceConfiguration } from './workspaceConfiguration';

export interface IConfigurationFactory {
    get(workspaceFolder: WorkspaceFolder): Promise<IWorkspaceConfiguration>;
}

export class DefaultConfigurationFactory implements IConfigurationFactory {
    constructor(private readonly logger: ILogger) {}

    public async get(
        workspaceFolder: WorkspaceFolder
    ): Promise<IWorkspaceConfiguration> {
        this.logger.log(
            'info',
            `Reading configuration for workspace ${workspaceFolder.name}`
        );
        return await PythonExtensionAwareWorkspaceConfiguration.for(
            new PlaceholderAwareWorkspaceConfiguration(
                new VscodeWorkspaceConfiguration(workspaceFolder),
                workspaceFolder,
                this.logger
            ),
            workspaceFolder,
            this.logger
        );
    }
}
