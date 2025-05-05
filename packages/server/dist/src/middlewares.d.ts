export declare function whitelist(list: any[] | Set<any>): (request: any, reject: any, approve: any) => void;
export declare function oncePerSubscription(path: string | (() => string) | undefined, firstSubscriptionCallback: any, lastUnsubscriptionCallback?: any): (this: any, request: any, reject: any, approve: any) => Promise<void>;
//# sourceMappingURL=middlewares.d.ts.map