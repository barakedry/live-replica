import { eventName } from "../common/event-name";
import { EventEmitter } from '../events/events';
import { LiveReplicaServer } from '../server/index';

class Connection extends EventEmitter {
    port: any;
    messageFromMaster: any;

    constructor(port: any) {
        super();

        this.port = port;

        this.setMaxListeners(50_000);

        this.messageFromMaster = ({ data }: { data: any; }) => {
            if (data.liveReplica) {
                const {event, payload, ack} = data.liveReplica;

                let ackFunction;
                if (ack) {
                    ackFunction = (...args: any[]) => {
                        this.send(ack, ...args);
                    }
                }

                this.emit(event, payload, ackFunction);
            }
        };

        this.port.onmessage = this.messageFromMaster;
    }

    send(event: any, ...args: any[]) {
        event = eventName(event);
        this.port.postMessage({
            liveReplica: {
                event,
                args
            }
        });
    }


    emit(event: any, ...args: any[]) {
        event = eventName(event);
        const callArgs = [event].concat(args) as [string, ...any[]];
        super.emit(...callArgs);
    }

    // @ts-expect-error
    addEventListener(event: any, handler: any): void {
        // @ts-expect-error
        super.addEventListener(eventName(event), handler);
    }

    // @ts-expect-error
    removeListener(event: any, handler: any): void {
        // @ts-expect-error
        super.removeListener(eventName(event), handler);
    }

}

/**
 *  LiveReplicaWorkerSocket
 */
export class LiveReplicaSharedWorkerServer extends LiveReplicaServer {
    private _masterConnection: any;

    constructor(port: any) {
        // @ts-expect-error
        super();

        this._masterConnection = new Connection(port);
        this.onConnect(this._masterConnection)
    }
}

export default LiveReplicaSharedWorkerServer;