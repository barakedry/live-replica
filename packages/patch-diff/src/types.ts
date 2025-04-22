import { EventEmitter } from '@live-replica/events';

export type KeyList = string[] | Set<string>;

export interface PatchDiffOptions {
  emitEvents?: boolean;
  undefinedKeyword?: string;
  deleteKeyword?: string;
  spliceKeyword?: string;
  protoKeyword?: string;
  fireGlobalChangeEvents?: boolean;
  maxKeysInLevel?: number;
  maxLevels?: number;
  maxListeners?: number;
  disableSplices?: boolean;
  overrides?: string[];
  context?: any;
  defer?: boolean;
}

export interface SpliceParams {
  index: number;
  itemsToRemove: number;
  itemsToAdd?: any[];
}

export interface DiffInfo<T = any> {
  snapshot?: boolean;
  hasAdditions?: boolean;
  hasAddedObjects?: boolean;
  hasDeletions?: boolean;
  hasUpdates?: boolean;
  hasDifferences?: boolean;
  additions?: Partial<T>;
  deletions?: Partial<T>;
  updates?: Partial<T>;
  addedObjects?: Partial<T>;
  differences?: Partial<T>;
  changeType?: 'displace' | 'change' | '';
}

export interface MutationOptions {
  defer?: boolean;
  context?: any;
  changeType?: 'displace' | 'change' | '';
  [key: string]: any;
}

export interface MergeOptions extends Omit<MutationOptions, 'overrides'> {
  overrides?: Record<string, true> | string[];
}

export type SubscribeCallback<T = any> = (
  patchOrSnapshot?: Partial<T>,
  changeInfo?: DiffInfo<T>,
  context?: any,
  deferred?: boolean,
  params?: Record<string, any>
) => void;

export type UnsubscribeCallback = () => void;

export interface GetAllResult {
  value: any;
  params: Record<string, any>;
  isPattern?: boolean;
}

export interface ProxyOptions {
  readonly: boolean;
}

// Define the interface for the PatchDiff class
export interface IPatchDiff<T = any> extends EventEmitter {
  apply(patch: Partial<T>, path?: string, options?: MergeOptions): Partial<T>;
  patch(patch: Partial<T>, path?: string, options?: MergeOptions): Partial<T>;
  merge(patch: Partial<T>, path?: string, options?: MergeOptions): Partial<T>;
  set<K extends keyof T>(value: T[K], path?: K, options?: MutationOptions): Partial<T>;
  displace<K extends keyof T>(value: T[K], path?: K, options?: MutationOptions): void;
  override<K extends keyof T>(value: T[K], path?: K, options?: MutationOptions): Partial<T>;
  remove(path?: string, options?: MutationOptions): Partial<T>;
  splice(spliceParams: SpliceParams, path?: string, options?: MutationOptions): Partial<T>;
  get<K extends keyof T>(path?: K): T[K];
  getAll(pathPattern: string): Array<GetAllResult>;
  getClone<K extends keyof T>(path?: K): T[K];
  subscribe: {
    (path: string, callback: SubscribeCallback<T>, skipInitial?: boolean): UnsubscribeCallback;
    (callback: SubscribeCallback<T>, skipInitial?: boolean): UnsubscribeCallback;
  };
  at(subPath: string): IPatchDiff<T>;
  scope(subPath: string): IPatchDiff<T>;
  whitelist(keys: KeyList): void;
  getWhenExists<K extends keyof T>(path?: K): Promise<T[K]>;
  whenAnything<K extends keyof T>(path?: K): Promise<T[K]>;
  getFullPath(subPath?: string): string;
  getData(proxyOptions?: Partial<ProxyOptions>): T;
  readonly data: T;
  readonly root: IPatchDiff<T>;
} 