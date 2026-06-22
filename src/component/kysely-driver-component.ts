import type { QueryResult, DatabaseConnection } from '../driver/database-connection.js'
import type { Dialect } from '../dialect/dialect.js'
import type { CompiledQuery } from '../query-compiler/compiled-query.js'
import type { TransactionSettings } from '../driver/driver.js'
import type { QueryId } from '../util/query-id.js'
import type { DatabaseIntrospector, TableMetadata, SchemaMetadata, DatabaseMetadataOptions } from '../dialect/database-introspector.js'
import type { StreamChunk } from '../channels/channel_util.js'
import type { KyselyPlugin } from '../plugin/kysely-plugin.js'
import type { LogConfig } from '../util/log.js'
import type { RootOperationNodeRaw } from './root-operation-node.js'
import type { PluginResultArgs, StreamMeta } from './plugin-component.js'
import { DefaultConnectionProvider } from '../driver/default-connection-provider.js'
import { SingleConnectionProvider } from '../driver/single-connection-provider.js'
import { DefaultQueryExecutor } from '../query-executor/default-query-executor.js'
import { RuntimeDriver } from '../driver/runtime-driver.js'
import { Log } from '../util/log.js'
import { ChannelIn, ChannelOut, Component } from '../channels/channel.js'
import { QueryCreator } from '../query-creator.js'
import { createQueryId } from '../util/query-id.js'

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

interface KyselyDriverConfig {
  readonly dialect: Dialect
  readonly log?: LogConfig
  readonly plugins?: readonly KyselyPlugin[]
}

export class KyselyDriverComponent extends Component {
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

  // Exposed for API wrapper (provideConnection) and shared with KyselyCompilerComponent.
  readonly driver: RuntimeDriver
  readonly compileQueryFn: (node: RootOperationNodeRaw, queryId: QueryId) => CompiledQuery

  private readonly dialect: Dialect
  private readonly executor: DefaultQueryExecutor
  private readonly executorNoPlugins: DefaultQueryExecutor
  private readonly introspector: DatabaseIntrospector

  private readonly transactions  = new Map<string, DatabaseConnection>()
  private readonly connections   = new Map<string, DatabaseConnection>()
  private readonly borrowedTxIds = new Set<string>()
  private readonly streams       = new Map<string, { iterator: AsyncIterableIterator<QueryResult<unknown>>; queryId: QueryId }>()

  constructor({ dialect, log, plugins }: KyselyDriverConfig) {
    super()
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

class IntrospectionWrapper<DB> {
  readonly #executor: DefaultQueryExecutor
  readonly #creator: QueryCreator<DB>

  constructor(executor: DefaultQueryExecutor, creator?: QueryCreator<DB>) {
    this.#executor = executor
    this.#creator = creator ?? new QueryCreator<DB>({})
  }

  selectFrom(from: any): any {
    return wrapIntrospectionBuilder(this.#creator.selectFrom(from), this.#executor)
  }

  with(name: any, expression: any): IntrospectionWrapper<any> {
    return new IntrospectionWrapper<any>(
      this.#executor,
      this.#creator.with(name, expression) as unknown as QueryCreator<any>,
    )
  }
}

function wrapIntrospectionBuilder(builder: any, executor: DefaultQueryExecutor): any {
  return new Proxy(builder, {
    get(target: any, prop: string | symbol) {
      if (prop === 'execute') {
        return async () => {
          const node = target.toOperationNode()
          const queryId = createQueryId()
          const compiled = executor.compileQuery(node, queryId)
          const result = await executor.executeQuery(compiled)
          return result.rows
        }
      }
      const value = target[prop]
      if (typeof value === 'function') {
        return (...args: any[]) => {
          const result = value.apply(target, args)
          if (result != null && typeof result === 'object' && typeof result.toOperationNode === 'function') {
            return wrapIntrospectionBuilder(result, executor)
          }
          return result
        }
      }
      return value
    },
  })
}
