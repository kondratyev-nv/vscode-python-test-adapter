import { tmpName } from 'tmp-promise';
import { readFile } from 'fs/promises';
import { TestSuiteInfo, TestInfo } from 'vscode-test-adapter-api';
import { ITestPlanTestLoader } from './testplanTestLoader';
import { ILogger } from '../logging/logger';

interface BasicInfo {
    name: string;
    description?: string;
    id: string;
}
interface Location {
    object_name: string;
    file: string;
    line_no: number;
}

interface TestCaseMetadata extends BasicInfo {
    location?: Location;
}

interface TestSuiteMetadata extends BasicInfo {
    location?: Location;
    test_cases: TestCaseMetadata[];
}

interface TestMetadata extends BasicInfo {
    test_suites: TestSuiteMetadata[];
}

interface TestPlanMetadata extends BasicInfo {
    tests: TestMetadata[];
}

export class TestPlanJSONBasedTestLoader implements ITestPlanTestLoader {
    private constructor(private readonly logger: ILogger, private readonly tmpFile: string) {}

    static async build(logger: ILogger): Promise<TestPlanJSONBasedTestLoader> {
        const tmpFile = await tmpName({
            prefix: 'testplan-info',
            postfix: '.json',
        });

        return new TestPlanJSONBasedTestLoader(logger, tmpFile);
    }

    getArgs(baseArguments: string[]): string[] {
        return ['--info', `json:${this.tmpFile}`].concat(baseArguments);
    }
    async parseOutput(_output: string): Promise<(TestSuiteInfo | TestInfo)[]> {
        try {
            const data = await readFile(this.tmpFile, 'utf8');

            // parse json and convert nulls to undefined
            const metadata = <TestPlanMetadata>JSON.parse(data, (_, value) => value ?? undefined);

            const parsed = metadata.tests.map(
                (test) =>
                    <TestSuiteInfo>{
                        type: 'suite',
                        id: test.id,
                        label: test.name,
                        description: test.description,
                        children: test.test_suites.map(
                            (suite) =>
                                <TestSuiteInfo>{
                                    type: 'suite',
                                    id: suite.id,
                                    label: suite.name,
                                    description: suite.description?.split('\n', 2)[0],
                                    tooltip: suite.description,
                                    file: suite.location?.file,
                                    line: suite.location?.line_no,
                                    children: suite.test_cases.map(
                                        (tc) =>
                                            <TestInfo>{
                                                type: 'test',
                                                id: tc.id,
                                                label: tc.name,
                                                description: tc.description?.split('\n', 2)[0],
                                                tooltip: tc.description,
                                                file: tc.location?.file,
                                                line: tc.location?.line_no,
                                            }
                                    ),
                                }
                        ),
                    }
            );

            return parsed;
        } catch (error) {
            this.logger.log('crit', `Discovering testplan tests failed: ${error}`);
            return [];
        }
    }
}
