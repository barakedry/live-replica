declare module '@live-replica/replica' {
    export interface ReplicaOptions {
        allowWrite?: boolean;
    }

    export default class Replica {
        static create<T>(data: T, options?: ReplicaOptions): T;
    }
} 