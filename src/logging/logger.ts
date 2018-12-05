
export interface ILogger {
    log(level: 'info' | 'warn' | 'crit', message: string): void;
}
