import * as path from 'path';

import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';
import { TestEvent } from 'vscode-test-adapter-api';

//  Typescript interfaces for behave json output
type IStatus = 'passed' | 'failed' | 'skipped';

interface IScenario {
    type:     string;
    keyword:  string;
    name:     string;
    tags:     any[];
    location: string;
    steps:    IStep[];
    status:   IStatus;
}

interface IFeature {
    keyword:  string;
    name:     string;
    tags:     any[];
    location: string;
    status:   IStatus;
    elements?: IScenario[];
}
interface IStep {
    keyword:   string;
    step_type: string;
    name:      string;
    location:  string;
    match:     any;
    result:    IResult;
    text?:     string[];
}
interface IResult {
    status:         IStatus;
    duration:       number;
    error_message?: string[];
}

function safeJsonParse(text: string) : IFeature[] {
    try {
        return JSON.parse(text);
    } catch (err) {
        // parse json has failed, return empty array
        return [];
    }
}

export function parseTestSuites(content: string, cwd: string): (TestSuiteInfo | TestInfo)[] {
    const discoveryResult = safeJsonParse(content);

    let stepid = 0;
    const suites = discoveryResult.map(feature => <TestSuiteInfo | TestInfo>({
            type: 'suite' as 'suite',
            id: feature.location,
            label: feature.name,
            file: extractFile(feature.location, cwd),
            line: extractLine(feature.location),
            tooltip: feature.location,
            children: (feature.elements || []).map(scenario => ({
                type: 'suite' as 'suite',
                id: scenario.location,
                label: scenario.name,
                file: extractFile(scenario.location, cwd),
                line: extractLine(scenario.location),
                tooltip: scenario.location,
                children: scenario.steps.map(step => ({
                    type: 'test' as 'test',
                    id: 'step' + (stepid += 1),
                    label: step.name,
                    file: extractFile(step.location, cwd),
                    line: extractLine(step.location),
                    tooltip: step.location,
                })),
            })),
        }));

    return suites;
}

function extractLine(text: string) : number {
    const separatorIndex = text.indexOf(':');
    return parseInt(text.substring(separatorIndex + 1), 10);
}

function extractFile(text: string, cwd : string) {
    const separatorIndex = text.indexOf(':');
    return path.resolve(cwd, text.substring(0, separatorIndex));
}

export function parseTestStates(content: string): TestEvent[] {
    const runtestResult = safeJsonParse(content);

    let states : TestEvent[] = [];

    let stepid = 0;

    runtestResult.forEach( feature => {
        (feature.elements || []).forEach( scenario => {
            const steps = scenario.steps.map( (step) : TestEvent => ({
                type: 'test' as 'test',
                state: step.result.status,
                test: 'step' + (stepid += 1),
                message: (step.result.error_message ? step.result.error_message.join('\n') : ''),
                decorations: [],
                description: undefined,
            }));
            states = states.concat(steps);
        });
    });

    return states;
}

