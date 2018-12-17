
import { parse } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

import { ILogger } from './logging/logger';

export class EnvironmentVariablesLoader {

    public static async load(envFilePath: string, logger: ILogger): Promise<{ [key: string]: string | undefined }> {
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

                    resolve(parse(content));
                });
            });
        } else {
            logger.log('info', `Environment variables file ${envPath} does not exist`);
            return {};
        }
    }
}
