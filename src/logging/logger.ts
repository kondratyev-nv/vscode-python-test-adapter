
export type LogLevel = 'info' | 'warn' | 'crit' | 'debug';

export interface ILogger {
    log(level: LogLevel, message: string): void;
}
