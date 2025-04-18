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

export interface DiffInfo {
  snapshot?: boolean;
  hasAdditions?: boolean;
  hasAddedObjects?: boolean;
  hasDeletions?: boolean;
  hasUpdates?: boolean;
  hasDifferences?: boolean;
  additions?: Record<string, any> | any[];
  deletions?: Record<string, any>;
  updates?: Record<string, any>;
  addedObjects?: Record<string, any>;
  differences?: Record<string, any> | any[];
  changeType?: 'displace' | 'change' | '';
}

export type SubscribeCallback = (
  patchOrSnapshot?: Record<string, any>,
  changeInfo?: DiffInfo,
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