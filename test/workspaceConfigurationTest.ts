
import { expect } from 'chai';
import 'mocha';
import { IMock, It, Mock } from 'typemoq';
import * as vscode from 'vscode';

import { WorkspaceConfiguration } from '../src/workspaceConfiguration';
describe('Workspace configuration', () => {
    const workspaceMock: IMock<vscode.WorkspaceConfiguration> = Mock.ofType();

    function mockWholeConfiguration(configurationMock: Map<string, any>) {
        workspaceMock.setup(x => x.get(It.isAny(), It.isAny()))
            .returns((x, y) => configurationMock.has(x) ? configurationMock.get(x) : y);
        workspaceMock.setup(x => x.get(It.isAny()))
            .returns(x => configurationMock.has(x) ? configurationMock.get(x) : undefined);

        const configuration = new WorkspaceConfiguration(workspaceMock.object);
        expect(configurationMock).to.be.not.null;
        return configuration;
    }

    beforeEach(() => {
        workspaceMock.reset();
    });

    it('should return default values on empty configuration', () => {
        const configuration = mockWholeConfiguration(new Map<string, any>());

        expect(configuration).to.be.not.null;
        expect(configuration.isUnitTestEnabled()).to.be.false;
        expect(configuration.getCwd()).to.be.undefined;
        expect(configuration.pythonPath()).to.be.eq('python');
        expect(configuration.parseUnitTestArguments().pattern).to.be.eq('test*.py');
        expect(configuration.parseUnitTestArguments().startDirectory).to.be.eq('.');
    });

    it('should return value from configuration when set', () => {
        const configuration = mockWholeConfiguration(
            new Map<string, any>([
                ['unitTest.unittestEnabled', false],
                ['unitTest.cwd', '/some/path'],
                ['pythonPath', '/some/path/to/python'],
                ['unitTest.unittestArgs', []]
            ])
        );
        expect(configuration).to.be.not.null;
        expect(configuration.isUnitTestEnabled()).to.be.false;
        expect(configuration.getCwd()).to.be.eq('/some/path');
        expect(configuration.pythonPath()).to.be.eq('/some/path/to/python');
        expect(configuration.parseUnitTestArguments().pattern).to.be.eq('test*.py');
        expect(configuration.parseUnitTestArguments().startDirectory).to.be.eq('.');
    });

    it('should parse start directory from unittestArgs', () => {
        const configuration = mockWholeConfiguration(
            new Map<string, any>([
                ['unitTest.unittestEnabled', true],
                ['unitTest.unittestArgs', ['-s', '/some/start/directory']]
            ])
        );
        expect(configuration).to.be.not.null;
        expect(configuration.isUnitTestEnabled()).to.be.true;
        expect(configuration.getCwd()).to.be.undefined;
        expect(configuration.pythonPath()).to.be.eq('python');
        expect(configuration.parseUnitTestArguments().pattern).to.be.eq('test*.py');
        expect(configuration.parseUnitTestArguments().startDirectory).to.be.eq('/some/start/directory');
    });

    it('should parse pattern from unittestArgs', () => {
        const configuration = mockWholeConfiguration(
            new Map<string, any>([
                ['unitTest.unittestArgs', ['-s', 'other/start/directory', '-p', '*Test.py']]
            ])
        );
        expect(configuration).to.be.not.null;
        expect(configuration.isUnitTestEnabled()).to.be.false;
        expect(configuration.getCwd()).to.be.undefined;
        expect(configuration.pythonPath()).to.be.eq('python');
        expect(configuration.parseUnitTestArguments().pattern).to.be.eq('*Test.py');
        expect(configuration.parseUnitTestArguments().startDirectory).to.be.eq('other/start/directory');
    });
});
