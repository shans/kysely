import type { QueryResult } from './driver/database-connection.js'
import type { QueryId } from '../shared/util/query-id.js'
import type { UnknownRow } from './util/type-utils.js'
import type { AbortableOperationOptions } from '../shared/util/abort.js'
import type { RootOperationNode as RootOperationNodeRaw } from '../operation-node/root-operation-node.js'

export type { RootOperationNodeRaw }

// Metadata carried through the plugin hole for streaming queries so the
// executor can set up the stream after transform without a shared state map.
export interface StreamMeta {
  readonly streamId: string
  readonly chunkSize: number
  readonly options?: AbortableOperationOptions
}

export interface PluginQueryArgs {
  readonly node: RootOperationNodeRaw
  readonly queryId: QueryId
  readonly streamMeta?: StreamMeta
}

export interface PluginResultArgs {
  readonly result: QueryResult<UnknownRow>
  readonly queryId: QueryId
}

// Output of the transformQuery phase — mirrors PluginQueryArgs with the
// transformed node; streamMeta is carried through unchanged.
export interface TransformedQueryResult {
  readonly node: RootOperationNodeRaw
  readonly queryId: QueryId
  readonly streamMeta?: StreamMeta
}
