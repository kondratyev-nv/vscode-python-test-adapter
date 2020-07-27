import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import { getReporter } from './utils/testConfiguration';

export function run(): Promise<void> {
    const reporter = getReporter();
    console.log(`Using ${reporter.reporter || 'default'} reporter`);

    // Create the mocha test
    const mochaRunner = new Mocha({
        ...{
            ui: 'tdd',   // the TDD UI is being used in extension.test.ts (suite, test, etc.)
            color: true, // colored output from test results
            slow: 1000,
            timeout: 10000,
        },
        ...reporter,
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        glob('**/**.test.js', { cwd: testsRoot }, (error, files) => {
            if (error) {
                return reject(error);
            }

            // Add files to the test suite
            files.forEach(f => mochaRunner.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mochaRunner.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                console.error(error);
                reject(error);
            }
        });
    });
}
