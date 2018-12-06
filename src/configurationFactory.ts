import { WorkspaceFolder } from 'vscode';

import { ILogger } from './logging/logger';
import { PlaceholderAwareWorkspaceConfiguration } from './placeholderAwareWorkspaceConfiguration';
import { VscodeWorkspaceConfiguration } from './vscodeWorkspaceConfiguration';
import { IWorkspaceConfiguration } from './workspaceConfiguration';

export class ConfigurationFactory {
    public static get(workspaceFolder: WorkspaceFolder, logger: ILogger): IWorkspaceConfiguration {
        logger.log('info', `Reading configuration for workspace ${workspaceFolder.name}`);
        return new PlaceholderAwareWorkspaceConfiguration(
            new VscodeWorkspaceConfiguration(workspaceFolder),
            workspaceFolder
        );
    }
}
