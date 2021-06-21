
import * as fs from 'fs';
import util = require('util');
export const readDir = util.promisify(fs.readdir);

export function isFileExists(file: fs.PathLike): Promise<boolean> {
    return new Promise<boolean>((resolve, _) => {
        fs.exists(file, exist => {
            resolve(exist);
        });
    });
}

export function readFile(file: fs.PathLike): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(file, 'utf-8', (error, content) => {
            if (error) {
                reject(error);
            }

            resolve(content);
        });
    });
}
