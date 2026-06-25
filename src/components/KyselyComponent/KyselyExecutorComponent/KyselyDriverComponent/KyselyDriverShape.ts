import type { CompiledQuery } from '../../../../types/query-compiler/compiled-query.js'
import type { TransactionSettings } from '../../../../shared/driver/driver.js'
import type { DatabaseMetadataOptions, TableMetadata, SchemaMetadata } from '../../../../types/dialect/database-introspector.js'
import type { StreamChunk } from '../../../../channels/channel_util.js'
import type { PluginResultArgs, StreamMeta } from '../../../../types/plugin-types.js'
import { ChannelIn, ChannelOut, Component } from '../../../../channels/channel.js'

export type TxAction =
  | ({ kind: 'begin'; txId: string } & TransactionSettings)
  | { kind: 'commit' }
  | { kind: 'rollback' }
  | { kind: 'savepoint'; name: string }
  | { kind: 'rollbackSavepoint'; name: string }
  | { kind: 'releaseSavepoint'; name: string }

export type ConnAction =
  | { kind: 'begin'; connId: string }
  | { kind: 'end' }

export interface CompiledStreamPayload extends StreamMeta {
  readonly compiled: CompiledQuery
}

export abstract class KyselyDriverShape extends Component {
  abstract readonly executeIn:     ChannelIn<CompiledQuery>
  abstract readonly streamStartIn: ChannelIn<CompiledStreamPayload>
  abstract readonly streamNextIn:  ChannelIn<void>
  abstract readonly streamEndIn:   ChannelIn<void>
  abstract readonly transactionIn: ChannelIn<TxAction>
  abstract readonly connectionIn:  ChannelIn<ConnAction>
  abstract readonly destroyIn:     ChannelIn<void>
  abstract readonly getTablesIn:   ChannelIn<DatabaseMetadataOptions | undefined>
  abstract readonly getSchemasIn:  ChannelIn<void>

  abstract readonly transformResultOut: ChannelOut<PluginResultArgs>
  abstract readonly streamChunkOut:     ChannelOut<StreamChunk<PluginResultArgs>>
  abstract readonly errorOut:           ChannelOut<unknown>
  abstract readonly tablesOut:          ChannelOut<TableMetadata[]>
  abstract readonly schemasOut:         ChannelOut<SchemaMetadata[]>
}
