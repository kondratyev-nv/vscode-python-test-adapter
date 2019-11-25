
import * as fs from 'fs';
import * as path from 'path';

import { ILogger } from './logging/logger';

const NEWLINE = '\n';
const ENV_FILE_LINE_REGEX = /^\s*([a-zA-Z_]\w*)\s*=\s*(.*?)?\s*$/;
const ESCAPED_NEWLINE_REGEX = /\\n/g;
const VARIABLE_REFERENCE_REGEX = /\${([a-zA-Z_]\w*)}/g;

function isEnclosedIn(s: string, substring: string): boolean {
    return s.startsWith(substring) && s.endsWith(substring);
}

export interface IEnvironmentVariables {
    [key: string]: string | undefined;
}

export class EnvironmentVariablesLoader {

    public static async load(
        envFilePath: string,
        globalEnvironment: IEnvironmentVariables,
        logger: ILogger
    ): Promise<IEnvironmentVariables> {
        if (!envFilePath) {
            logger.log('info', 'Environment variables file is not defined');
            return {};
        }
        const envPath = path.resolve(envFilePath);
        const envFileExists = await new Promise<boolean>((resolve, _) => {
            fs.exists(envPath, exist => {
                resolve(exist);
            });
        });
        if (envFileExists) {
            logger.log('info', `Loading environment variables file ${envPath}`);
            return await new Promise<{ [key: string]: string | undefined }>((resolve, _) => {
                fs.readFile(envPath, (error, content) => {
                    if (error) {
                        logger.log('warn', `Could not read environment variables file ${envPath}`);
                        resolve({});
                    }

                    resolve(EnvironmentVariablesLoader.parse(content, globalEnvironment));
                });
            });
        } else {
            logger.log('info', `Environment variables file ${envPath} does not exist`);
            return {};
        }
    }

    private static parse(buffer: Buffer, globalEnvironment: IEnvironmentVariables): IEnvironmentVariables {

        const environmentVariables: IEnvironmentVariables = {};

        buffer.toString().split(NEWLINE).forEach(line => {

            const parsedKeyValue = EnvironmentVariablesLoader.parseLine(line);
            if (!parsedKeyValue) {
                return;
            }

            const [key, value] = parsedKeyValue;
            environmentVariables[key] = EnvironmentVariablesLoader.resolveEnvironmentVariableValue(
                value, environmentVariables, globalEnvironment
            );
        });

        return environmentVariables;
    }

    private static parseLine(line: string): [string, string] | undefined {
        const matchedKeyValue = line.match(ENV_FILE_LINE_REGEX);
        if (matchedKeyValue == null) {
            return undefined;
        }

        const key = matchedKeyValue[1];
        const value = EnvironmentVariablesLoader.normalizeValue(matchedKeyValue[2] || '');

        return [key, value];
    }

    private static normalizeValue(value: string): string {
        const isDoubleQuoted = isEnclosedIn(value, '"');
        const isSingleQuoted = isEnclosedIn(value, '\'');
        if (isSingleQuoted || isDoubleQuoted) {
            const valueWithoutQuotes = value.substring(1, value.length - 1);
            return isDoubleQuoted ?
                valueWithoutQuotes.replace(ESCAPED_NEWLINE_REGEX, NEWLINE) :
                valueWithoutQuotes;
        }
        return value.trim();
    }

    private static resolveEnvironmentVariableValue(
        value: string,
        localEnvironment: IEnvironmentVariables,
        globalEnvironment: IEnvironmentVariables
    ): string {
        const replacement = value.replace(VARIABLE_REFERENCE_REGEX, (match, variableReference) => {
            if (!variableReference) {
                return match;
            }

            return localEnvironment[variableReference] || globalEnvironment[variableReference] || '';
        });
        if (replacement === value) {
            return value;
        }
        return EnvironmentVariablesLoader.resolveEnvironmentVariableValue(
            replacement.replace(/\\\$/g, '$'), localEnvironment, globalEnvironment
        );
    }
}
