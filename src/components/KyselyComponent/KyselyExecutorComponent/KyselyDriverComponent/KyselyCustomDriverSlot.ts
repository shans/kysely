import type { QueryResult, DatabaseConnection } from '../../../../types/driver/database-connection.js'
import type { CompiledQuery } from '../../../../types/query-compiler/compiled-query.js'
import type { QueryId } from '../../../../shared/util/query-id.js'
import type { DatabaseIntrospector, DatabaseMetadataOptions, TableMetadata, SchemaMetadata } from '../../../../types/dialect/database-introspector.js'
import type { StreamChunk } from '../../../../channels/channel_util.js'
import type { LogConfig } from '../../../../shared/util/log.js'
import type { RootOperationNodeRaw } from '../../../../codeView/RootOperationNode.js'
import type { PluginResultArgs } from '../../../../types/plugin-types.js'
import type { Dialect } from '../../../../types/dialect/dialect.js'
import type { TransactionSettings } from '../../../../shared/driver/driver.js'
import { KyselyDriverShape, type TxAction, type ConnAction, type CompiledStreamPayload } from './KyselyDriverShape.js'
import { DefaultConnectionProvider } from './DefaultConnectionProvider.js'
import { SingleConnectionProvider } from './SingleConnectionProvider.js'
import { DefaultQueryExecutor } from './DefaultQueryExecutor.js'
import { RuntimeDriver } from './RuntimeDriver.js'
import { IntrospectionWrapper } from './IntrospectionWrapper.js'
import { Log } from '../../../../shared/util/log.js'
import { ChannelIn, ChannelOut } from '../../../../channels/channel.js'

export class KyselyCustomDriverSlot extends KyselyDriverShape {
  readonly executeIn     = new ChannelIn<CompiledQuery>(this, this.handleExecute)
  readonly streamStartIn = new ChannelIn<CompiledStreamPayload>(this, this.handleStreamStart)
  readonly streamNextIn  = new ChannelIn<void>(this, this.handleStreamNext)
  readonly streamEndIn   = new ChannelIn<void>(this, this.handleStreamEnd)
  readonly transactionIn = new ChannelIn<TxAction>(this, this.handleTx)
  readonly connectionIn  = new ChannelIn<ConnAction>(this, this.handleConn)
  readonly destroyIn     = new ChannelIn<void>(this, this.handleDestroy)
  readonly getTablesIn   = new ChannelIn<DatabaseMetadataOptions | undefined>(this, this.handleGetTables)
  readonly getSchemasIn  = new ChannelIn<void>(this, this.handleGetSchemas)

  readonly transformResultOut = new ChannelOut<PluginResultArgs>()
  readonly streamChunkOut     = new ChannelOut<StreamChunk<PluginResultArgs>>()
  readonly errorOut           = new ChannelOut<unknown>()
  readonly tablesOut          = new ChannelOut<TableMetadata[]>()
  readonly schemasOut         = new ChannelOut<SchemaMetadata[]>()

  private readonly dialect: Dialect
  private readonly driver: RuntimeDriver
  private readonly executor: DefaultQueryExecutor
  private readonly executorNoPlugins: DefaultQueryExecutor
  private readonly introspector: DatabaseIntrospector
  private readonly compileQueryFn: (node: RootOperationNodeRaw, queryId: QueryId) => CompiledQuery

  private readonly transactions  = new Map<string, DatabaseConnection>()
  private readonly connections   = new Map<string, DatabaseConnection>()
  private readonly borrowedTxIds = new Set<string>()
  private readonly streams       = new Map<string, { iterator: AsyncIterableIterator<QueryResult<unknown>>; queryId: QueryId }>()

  constructor(dialect: Dialect, log?: LogConfig) {
    super()
    this.dialect = dialect
    const adapter = dialect.createAdapter()
    const compiler = dialect.createQueryCompiler()
    this.driver = new RuntimeDriver(dialect.createDriver(), adapter, new Log(log ?? []))
    this.executor = new DefaultQueryExecutor(
      compiler,
      adapter,
      new DefaultConnectionProvider(this.driver),
      [],
    )
    this.executorNoPlugins = this.executor.withoutPlugins()
    this.compileQueryFn = this.executor.compileQuery.bind(this.executor) as (node: RootOperationNodeRaw, queryId: QueryId) => CompiledQuery
    this.introspector = dialect.createIntrospector(new IntrospectionWrapper<any>(this.executor) as any)
  }

  private async handleExecute(compiled: CompiledQuery): Promise<void> {
    const pinnedConnection = this.getPinnedConnection(this._tags)
    try {
      let result: QueryResult<unknown>
      if (pinnedConnection) {
        result = await pinnedConnection.executeQuery(compiled)
      } else {
        result = await this.executorNoPlugins.executeQuery(compiled)
      }
      this.transformResultOut.send({ result: result as any, queryId: compiled.queryId })
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  private handleStreamStart({ compiled, streamId, chunkSize, options }: CompiledStreamPayload): void {
    try {
      const pinnedConnection = this.getPinnedConnection(this._tags)
      const ex = pinnedConnection
        ? this.executorNoPlugins.withConnectionProvider(new SingleConnectionProvider(pinnedConnection))
        : this.executorNoPlugins
      this.streams.set(streamId, { iterator: ex.stream(compiled, chunkSize, options), queryId: compiled.queryId })
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  private async handleTx(action: TxAction): Promise<void> {
    switch (action.kind) {
      case 'begin': {
        const { kind: _, ...payload } = action
        return this.handleTxBegin(payload)
      }
      case 'commit':            return this.handleTxCommit()
      case 'rollback':          return this.handleTxRollback()
      case 'savepoint':         return this.handleSavepoint(action)
      case 'rollbackSavepoint': return this.handleRollbackSavepoint(action)
      case 'releaseSavepoint':  return this.handleReleaseSavepoint(action)
    }
  }

  private async handleConn(action: ConnAction): Promise<void> {
    switch (action.kind) {
      case 'begin': return this.handleConnBegin(action.connId)
      case 'end':   return this.handleConnEnd()
    }
  }

  private async handleTxBegin({ txId, ...settings }: { txId: string } & TransactionSettings): Promise<void> {
    const connId = this.getConnId(this._tags)
    const borrowed = connId !== undefined
    let connection: DatabaseConnection
    if (borrowed) {
      connection = this.connections.get(connId)!
      this.borrowedTxIds.add(txId)
    } else {
      connection = await this.driver.acquireConnection()
    }
    try {
      await this.driver.beginTransaction(connection, settings)
    } catch (error) {
      if (!borrowed) await this.driver.releaseConnection(connection)
      this.borrowedTxIds.delete(txId)
      throw error
    }
    this.transactions.set(txId, connection)
  }

  private async handleTxCommit(): Promise<void> {
    const txId = this.getTxId(this._tags)
    if (!txId) return
    const connection = this.transactions.get(txId)!
    this.transactions.delete(txId)
    await this.driver.commitTransaction(connection)
    if (!this.borrowedTxIds.delete(txId)) {
      await this.driver.releaseConnection(connection)
    }
  }

  private async handleTxRollback(): Promise<void> {
    const txId = this.getTxId(this._tags)
    if (!txId) return
    const connection = this.transactions.get(txId)!
    this.transactions.delete(txId)
    await this.driver.rollbackTransaction(connection)
    if (!this.borrowedTxIds.delete(txId)) {
      await this.driver.releaseConnection(connection)
    }
  }

  private async handleSavepoint({ name }: { name: string }): Promise<void> {
    const connection = this.getPinnedConnection(this._tags)
    if (!connection) throw new Error('savepoint called outside of transaction')
    await this.driver.savepoint?.(connection, name, this.compileQueryFn)
  }

  private async handleRollbackSavepoint({ name }: { name: string }): Promise<void> {
    const connection = this.getPinnedConnection(this._tags)
    if (!connection) throw new Error('rollbackToSavepoint called outside of transaction')
    await this.driver.rollbackToSavepoint?.(connection, name, this.compileQueryFn)
  }

  private async handleReleaseSavepoint({ name }: { name: string }): Promise<void> {
    const connection = this.getPinnedConnection(this._tags)
    if (!connection) throw new Error('releaseSavepoint called outside of transaction')
    await this.driver.releaseSavepoint?.(connection, name, this.compileQueryFn)
  }

  private async handleStreamNext(): Promise<void> {
    const streamId = this.getStreamId(this._tags)
    if (!streamId) return
    const { iterator, queryId } = this.streams.get(streamId)!
    try {
      const result = await iterator.next()
      if (result.done) {
        this.streams.delete(streamId)
        this.streamChunkOut.send({ done: true })
      } else {
        this.streamChunkOut.send({ done: false, value: { result: result.value as any, queryId } })
      }
    } catch (error) {
      this.streams.delete(streamId)
      this.errorOut.send(error)
    }
  }

  private async handleStreamEnd(): Promise<void> {
    const streamId = this.getStreamId(this._tags)
    if (!streamId) return
    const { iterator } = this.streams.get(streamId)!
    this.streams.delete(streamId)
    try { await iterator.return?.() } catch { /* ignore cleanup errors */ }
  }

  private async handleDestroy(): Promise<void> {
    await this.driver.destroy()
  }

  private async handleGetTables(options?: DatabaseMetadataOptions): Promise<void> {
    try {
      this.tablesOut.send(await this.getIntrospector().getTables(options))
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  private async handleGetSchemas(): Promise<void> {
    try {
      this.schemasOut.send(await this.getIntrospector().getSchemas())
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  private async handleConnBegin(connId: string): Promise<void> {
    const connection = await this.driver.acquireConnection()
    this.connections.set(connId, connection)
  }

  private async handleConnEnd(): Promise<void> {
    const connId = this.getConnId(this._tags)
    if (!connId) return
    const connection = this.connections.get(connId)!
    this.connections.delete(connId)
    await this.driver.releaseConnection(connection)
  }

  private getIntrospector(): DatabaseIntrospector {
    const pinnedConnection = this.getPinnedConnection(this._tags)
    if (!pinnedConnection) return this.introspector
    const pinnedExecutor = this.executor.withConnectionProvider(
      new SingleConnectionProvider(pinnedConnection),
    )
    return this.dialect.createIntrospector(new IntrospectionWrapper<any>(pinnedExecutor) as any)
  }

  private getStreamId(tags: Set<string>): string | undefined {
    for (const tag of tags) { if (this.streams.has(tag)) return tag }
    return undefined
  }

  private getTxId(tags: Set<string>): string | undefined {
    for (const tag of tags) { if (this.transactions.has(tag)) return tag }
    return undefined
  }

  private getConnId(tags: Set<string>): string | undefined {
    for (const tag of tags) { if (this.connections.has(tag)) return tag }
    return undefined
  }

  private getPinnedConnection(tags: Set<string>): DatabaseConnection | undefined {
    const txId = this.getTxId(tags)
    if (txId !== undefined) return this.transactions.get(txId)
    const connId = this.getConnId(tags)
    if (connId !== undefined) return this.connections.get(connId)
    return undefined
  }
}
