import { AsyncDirective } from 'lit-html/async-directive.js';
export declare class LiveReplicaDirective extends AsyncDirective {
    render(dataOrReplica: any, relativePath: any, transformer?: (v: any) => any): any;
    subscribe(dataOrReplica: any, relativePath: any, transformer: any): void;
    disconnected(): void;
    reconnected(): void;
}
export declare const live: (dataOrReplica: any, relativePath: any, transformer?: ((v: any) => any) | undefined) => import("lit-html/directive.js").DirectiveResult<typeof LiveReplicaDirective>;
//# sourceMappingURL=directive.d.ts.map