
import { ILogOutputChannel } from '../logOutputChannel';

export class NoopOutputChannel implements ILogOutputChannel {
    public write(_: string): void {
        /**/
    }
}
