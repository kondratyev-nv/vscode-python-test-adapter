import { WorkspaceFolder } from 'vscode';

import { PlaceholderAwareWorkspaceConfiguration } from './placeholderAwareWorkspaceConfiguration';
import { VscodeWorkspaceConfiguration } from './vscodeWorkspaceConfiguration';
import { IWorkspaceConfiguration } from './workspaceConfiguration';

export class ConfigurationFactory {
    public static get(workspaceFolder: WorkspaceFolder): IWorkspaceConfiguration {
        return new PlaceholderAwareWorkspaceConfiguration(
            new VscodeWorkspaceConfiguration(workspaceFolder),
            workspaceFolder
        );
    }
}
