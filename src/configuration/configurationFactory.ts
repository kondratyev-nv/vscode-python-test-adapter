import { WorkspaceFolder } from 'vscode';

import { ILogger } from '../logging/logger';
import { PlaceholderAwareWorkspaceConfiguration } from './placeholderAwareWorkspaceConfiguration';
import { VscodeWorkspaceConfiguration } from './vscodeWorkspaceConfiguration';
import { IWorkspaceConfiguration } from './workspaceConfiguration';

export interface IConfigurationFactory {
    get(workspaceFolder: WorkspaceFolder): IWorkspaceConfiguration;
}

export class DefaultConfigurationFactory implements IConfigurationFactory {
    constructor(private readonly logger: ILogger) { }

    public get(workspaceFolder: WorkspaceFolder): IWorkspaceConfiguration {
        this.logger.log('info', `Reading configuration for workspace ${workspaceFolder.name}`);
        return new PlaceholderAwareWorkspaceConfiguration(
            new VscodeWorkspaceConfiguration(workspaceFolder),
            workspaceFolder,
            this.logger
        );
    }
}
