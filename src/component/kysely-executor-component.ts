import type { QueryResult, DatabaseConnection } from '../driver/database-connection.js'
import type { Dialect } from '../dialect/dialect.js'
import type { CompiledQuery } from '../query-compiler/compiled-query.js'
import type { TransactionSettings } from '../driver/driver.js'
import type { QueryId } from '../util/query-id.js'
import type { DatabaseIntrospector, TableMetadata, SchemaMetadata, DatabaseMetadataOptions } from '../dialect/database-introspector.js'
import type { KyselyProps } from '../kysely.js'
import type { AbortableOperationOptions } from '../util/abort.js'
import type { StreamChunk } from '../channels/channel_util.js'
import type { RootOperationNode } from '../operation-node/root-operation-node.js'
import type { PluginResultArgs, TransformedQueryResult } from './plugin-component.js'
import type { KyselyComponentConfig } from './kysely-component.js'
import { Kysely as KyselyImpl } from '../kysely.js'
import { DefaultConnectionProvider } from '../driver/default-connection-provider.js'
import { SingleConnectionProvider } from '../driver/single-connection-provider.js'
import { DefaultQueryExecutor } from '../query-executor/default-query-executor.js'
import { RuntimeDriver } from '../driver/runtime-driver.js'
import { Log } from '../util/log.js'
import { ChannelIn, ChannelOut, Component } from '../channels/channel.js'

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

// Handles query execution, compilation, streaming, transactions, connections,
// and introspection. Receives already-transformed queries from the plugin hole
// (one input per action type) and sends results back into the plugin hole for
// transformResult. Never sends to the plugin hole for transformQuery — that
// phase is handled upstream by KyselyEntryComponent and the plugin hole wiring.
export class KyselyExecutorComponent extends Component {
  // One input per action type — KyselyComponent routes from the plugin hole's
  // transformQuery output using connectFiltered.
  readonly executeQueryIn = new ChannelIn<TransformedQueryResult>(this, this.handleExecuteQuery)
  readonly compileQueryIn = new ChannelIn<TransformedQueryResult>(this, this.handleCompileQuery)
  readonly streamQueryIn  = new ChannelIn<TransformedQueryResult>(this, this.handleStreamQuery)

  // Pre-compiled execute: no transformQuery needed; result still goes through
  // the plugin hole's transformResult.
  readonly compiledIn = new ChannelIn<CompiledQuery>(this, this.handleCompiled)

  // Session management inputs — no plugin involvement.
  readonly transactionIn          = new ChannelIn<TxAction>(this, this.handleTx)
  readonly connectionIn        = new ChannelIn<ConnAction>(this, this.handleConn)
  readonly streamNextIn  = new ChannelIn<void>(this, this.handleStreamNext)
  readonly streamEndIn   = new ChannelIn<void>(this, this.handleStreamEnd)
  readonly destroyIn     = new ChannelIn<void>(this, this.handleDestroy)
  readonly getTablesIn   = new ChannelIn<DatabaseMetadataOptions | undefined>(this, this.handleGetTables)
  readonly getSchemasIn  = new ChannelIn<void>(this, this.handleGetSchemas)

  // Sends result to the plugin hole's transformResult input.
  readonly transformResultOut = new ChannelOut<PluginResultArgs>()

  readonly compiledOut    = new ChannelOut<CompiledQuery>()
  readonly streamChunkOut = new ChannelOut<StreamChunk<QueryResult<unknown>>>()
  readonly errorOut       = new ChannelOut<unknown>()
  readonly tablesOut      = new ChannelOut<TableMetadata[]>()
  readonly schemasOut     = new ChannelOut<SchemaMetadata[]>()

  // Exposed for use by the API wrapper (ComponentQueryExecutor.provideConnection).
  readonly driver: RuntimeDriver
  private readonly dialect: Dialect
  // executor: with config plugins — used for executor.stream() so each chunk's
  // transformResult is applied by the executor's built-in #transformResult.
  private readonly executor: DefaultQueryExecutor
  // executorNoPlugins: used for executeQuery paths where the plugin hole handles
  // transformResult instead, preventing double application.
  private readonly executorNoPlugins: DefaultQueryExecutor
  private readonly compileQueryFn: (node: RootOperationNode, queryId: QueryId) => CompiledQuery
  private readonly introspector: DatabaseIntrospector

  private readonly transactions  = new Map<string, DatabaseConnection>()
  private readonly connections   = new Map<string, DatabaseConnection>()
  private readonly borrowedTxIds = new Set<string>()
  private readonly streams       = new Map<string, AsyncIterableIterator<QueryResult<unknown>>>()

  constructor(config: KyselyComponentConfig) {
    super()
    const { dialect, log, plugins } = config
    this.dialect = dialect
    const adapter = dialect.createAdapter()
    this.driver = new RuntimeDriver(dialect.createDriver(), adapter, new Log(log ?? []))
    this.executor = new DefaultQueryExecutor(
      dialect.createQueryCompiler(),
      adapter,
      new DefaultConnectionProvider(this.driver),
      plugins ? [...plugins] : [],
    )
    this.executorNoPlugins = this.executor.withoutPlugins()
    this.compileQueryFn = this.executor.compileQuery.bind(this.executor)
    const internalKysely = new KyselyImpl<any>({
      config: config as any,
      driver: this.driver,
      executor: this.executor,
      dialect,
    } as KyselyProps)
    this.introspector = dialect.createIntrospector(internalKysely)
  }

  // Compile → execute → send result to plugin hole for transformResult.
  private async handleExecuteQuery({ node, queryId }: TransformedQueryResult): Promise<void> {
    const pinnedConnection = this.getPinnedConnection(this._tags)
    try {
      const compiled = this.compileQueryFn(node, queryId)
      let result: QueryResult<unknown>
      if (pinnedConnection) {
        result = await pinnedConnection.executeQuery(compiled)
      } else {
        // executorNoPlugins: transformResult is NOT applied here — the plugin
        // hole handles it via transformResultOut.
        result = await this.executorNoPlugins.executeQuery(compiled)
      }
      this.transformResultOut.send({ result: result as any, queryId })
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  // Synchronous compile path — no transformResult needed.
  private handleCompileQuery({ node, queryId }: TransformedQueryResult): void {
    try {
      this.compiledOut.send(this.compileQueryFn(node, queryId))
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  // Synchronous stream setup — executor.stream (with config plugins) handles
  // per-chunk transformResult internally, matching original behaviour.
  private handleStreamQuery({ node, queryId, streamMeta }: TransformedQueryResult): void {
    if (!streamMeta) return
    const { streamId, chunkSize, options } = streamMeta
    try {
      const pinnedConnection = this.getPinnedConnection(this._tags)
      const compiled = this.compileQueryFn(node, queryId)
      const ex = pinnedConnection
        ? this.executor.withConnectionProvider(new SingleConnectionProvider(pinnedConnection))
        : this.executor
      this.streams.set(streamId, ex.stream(compiled, chunkSize, options))
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  // Execute a pre-compiled query (no transformQuery); result goes through the
  // plugin hole's transformResult via transformResultOut.
  private async handleCompiled(compiled: CompiledQuery): Promise<void> {
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
    const iterator = this.streams.get(streamId)!
    try {
      const result = await iterator.next()
      if (result.done) {
        this.streams.delete(streamId)
        this.streamChunkOut.send({ done: true })
      } else {
        this.streamChunkOut.send({ done: false, value: result.value })
      }
    } catch (error) {
      this.streams.delete(streamId)
      this.errorOut.send(error)
    }
  }

  private async handleStreamEnd(): Promise<void> {
    const streamId = this.getStreamId(this._tags)
    if (!streamId) return
    const iterator = this.streams.get(streamId)!
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
    const pinnedKysely = new KyselyImpl<any>({
      config: {} as any,
      driver: this.driver,
      executor: pinnedExecutor,
      dialect: this.dialect,
    } as KyselyProps)
    return this.dialect.createIntrospector(pinnedKysely)
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
