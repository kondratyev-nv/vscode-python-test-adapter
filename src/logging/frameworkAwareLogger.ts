
import { ILogger } from './logger';

export class FrameworkAwareLogger implements ILogger {
    constructor(private readonly framework: string, private readonly logger: ILogger) { }

    public log(level: 'info' | 'warn' | 'crit', message: string): void {
        this.logger.log(level, `[${this.framework} runner] ${message}`);
    }
}
