// API wrapper: exposes the exact Kysely<DB> interface backed by KyselyComponent.
//
// `new Kysely<DB>(config)` (exported below) is a drop-in replacement for the
// original Kysely constructor. The top-level db object is a plain explicit object
// (createApiObject) — no Proxy. Structural builder calls (where, select, etc.) are
// delegated to a KyselyBuilder for node accumulation; terminal calls (execute,
// compile, etc.) are intercepted by a Proxy in wrapBuilder and routed through
// component channels. Plugins are applied as plain functions in the API layer
// (transformQuery before sending, transformResult after receiving) per tactic 07.

import { KyselyComponent, type TxAction, type StreamAction, type StreamStartPayload } from './components/KyselyComponent/KyselyComponent.js'
import { KyselyBuiltinCompilerSlot, KyselyCustomCompilerSlot } from './components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent.js'
import { KyselyBuiltinDriverSlot, KyselyCustomDriverSlot } from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/KyselyDriverComponent.js'
import { SqliteAdapter } from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/sqlite-adapter.js'
import { PostgresAdapter } from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/postgres-adapter.js'
import { MysqlAdapter } from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mysql-adapter.js'
import { MssqlAdapter } from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mssql-adapter.js'
import { PGliteAdapter } from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/pglite-adapter.js'
import type { RootOperationNodeRaw } from './codeView/RootOperationNode.js'
import type { CompiledQuery } from './types/query-compiler/compiled-query.js'
import type { QueryResult } from './types/driver/database-connection.js'
import type { DialectAdapter } from './types/dialect/dialect-adapter.js'
import type { KyselyPlugin } from './types/plugin/kysely-plugin.js'
import type { Dialect } from './types/dialect/dialect.js'
import type { KyselyDialectConfig } from './types/dialect/dialect-config.js'
import type { LogConfig } from './types/util/log.js'
import { QueryNode } from './shared/operation-node/query-node.js'
import { asAsyncFunction, asFunction } from './channels/channel.js'
import { asStreamingFunction } from './channels/channel_util.js'
import { createQueryId } from './shared/util/query-id.js'
import { assertNotAborted, throwReasonWithTiming } from './shared/util/abort.js'
import type { AbortableOperationOptions } from './types/util/abort.js'
import type { Kysely as KyselyPublicType } from './types/transaction-types.js'
import { NoResultError, isNoResultErrorConstructor } from './codeView/query-builder/no-result-error.js'
import { KyselyBuilder } from './codeView/KyselyBuilder.js'
import { WithSchemaPlugin } from './shared/plugin/with-schema/with-schema-plugin.js'
import { isCompilable } from './shared/util/compilable.js'
import { InsertResult } from './codeView/query-builder/insert-result.js'
import { UpdateResult } from './codeView/query-builder/update-result.js'
import { DeleteResult } from './codeView/query-builder/delete-result.js'

interface ApiConfig {
  readonly dialect: Dialect
  readonly log?: LogConfig
  readonly plugins?: readonly KyselyPlugin[]
}

function createAdapter(dialectConfig: KyselyDialectConfig): DialectAdapter {
  switch (dialectConfig.dialectName) {
    case 'sqlite':   return new SqliteAdapter()
    case 'postgres': return new PostgresAdapter()
    case 'mysql':    return new MysqlAdapter()
    case 'mssql':    return new MssqlAdapter()
    case 'pglite':   return new PGliteAdapter()
  }
}

// Shim QueryExecutor returned by db.getExecutor() — used by sql`...`.execute(db)
// and any other caller that needs a QueryExecutor directly. Routes compile and
// execute through ApiContext channels. transformQuery is a no-op because plugins
// are already applied inside the component's compileQuery path; applying them
// here too would double-transform.
class ComponentQueryExecutor {
  readonly #ctx: ApiContext
  readonly adapter: DialectAdapter
  readonly plugins: ReadonlyArray<KyselyPlugin>

  constructor(ctx: ApiContext, adapter: DialectAdapter, plugins: ReadonlyArray<KyselyPlugin>) {
    this.#ctx = ctx
    this.adapter = adapter
    this.plugins = plugins
  }

  transformQuery<T extends RootOperationNodeRaw>(node: T): T { return node }

  compileQuery<R = unknown>(node: RootOperationNodeRaw): CompiledQuery<R> {
    return this.#ctx.compileNode(node) as CompiledQuery<R>
  }

  async executeQuery<R>(compiledQuery: CompiledQuery<R>): Promise<QueryResult<R>> {
    const callSite = new Error()
    try {
      return await (this.#ctx.executeQuery(compiledQuery as CompiledQuery<unknown>) as Promise<QueryResult<R>>)
    } catch (error) {
      appendCallStack(error, callSite)
      throw error
    }
  }

  async *stream<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('.stream() is not yet supported in component mode')
  }

  async provideConnection<T>(): Promise<T> {
    throw new Error('.connection() is not yet supported in component mode')
  }

  withConnectionProvider(): ComponentQueryExecutor { return this }
  withPlugin(): ComponentQueryExecutor { return this }
  withPlugins(): ComponentQueryExecutor { return this }
  withPluginAtFront(): ComponentQueryExecutor { return this }
  withoutPlugins(): ComponentQueryExecutor { return this }
}

// Shared execution context threaded through all API objects.
interface ApiContext {
  executeNode:         (node: RootOperationNodeRaw, extraTags?: Set<string>) => Promise<QueryResult<unknown>>
  compileNode:         (node: RootOperationNodeRaw) => CompiledQuery
  executeQuery:        (compiled: CompiledQuery) => Promise<QueryResult<unknown>>
  streamNode:          (node: RootOperationNodeRaw, chunkSize: number, options?: AbortableOperationOptions, extraTags?: Set<string>) => AsyncIterableIterator<QueryResult<unknown>>
  getExecutor:         () => ComponentQueryExecutor
  getTables:           (options?: any, tags?: Set<string>) => Promise<any[]>
  getSchemas:          (tags?: Set<string>) => Promise<any[]>
  destroy:             () => Promise<void>
  txBegin:             (payload: Omit<Extract<TxAction, { kind: 'begin' }>, 'kind'>, connTags?: Set<string>) => Promise<void>
  txCommit:            (txId: string) => Promise<void>
  txRollback:          (txId: string) => Promise<void>
  savepoint:           (txId: string, name: string) => Promise<void>
  rollbackToSavepoint: (txId: string, name: string) => Promise<void>
  releaseSavepoint:    (txId: string, name: string) => Promise<void>
  connBegin:           (connId: string) => Promise<void>
  connEnd:             (connId: string) => Promise<void>
}

// Returns true for Kysely query builders — distinguishes them from expression
// fragments like DynamicReferenceBuilder (which lack toOperationNode).
function isExecutableBuilder(value: unknown): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as any).toOperationNode === 'function'
  )
}

// Routes a value returned by a builder structural method to the right wrapper.
function dispatch(value: unknown, ctx: ApiContext, extraTags?: Set<string>): unknown {
  if (isExecutableBuilder(value)) return wrapBuilder(value, ctx, extraTags)
  if (value != null && typeof value === 'object') return wrapModule(value, ctx, extraTags)
  if (typeof value === 'function')  return wrapCallableModule(value, null, ctx, extraTags)
  return value
}

// Applies extra plugins' transformResult to a result (for pre-compiled executeQuery
// paths where transformQuery does not apply).
async function applyExtraTransformResult(
  result: QueryResult<unknown>,
  queryId: ReturnType<typeof createQueryId>,
  plugins: ReadonlyArray<KyselyPlugin>,
): Promise<QueryResult<unknown>> {
  for (const plugin of plugins) {
    result = await plugin.transformResult({ queryId, result: result as any }) as QueryResult<unknown>
  }
  return result
}

// Creates a derived ApiContext that applies extra plugins' transformQuery before
// sending to the component and transformResult after receiving — using the same
// queryId so plugins can correlate the two calls (e.g. via WeakMap).
// For pre-compiled executeQuery paths, only transformResult is applied.
function withExtraPlugins(baseCtx: ApiContext, plugins: ReadonlyArray<KyselyPlugin>): ApiContext {
  if (plugins.length === 0) return baseCtx

  function applyTransformQuery(node: RootOperationNodeRaw, queryId: ReturnType<typeof createQueryId>): RootOperationNodeRaw {
    let transformed: RootOperationNodeRaw = node
    for (const plugin of plugins) {
      transformed = plugin.transformQuery({ node: transformed as any, queryId }) as RootOperationNodeRaw
    }
    return transformed
  }

  return {
    ...baseCtx,
    compileNode: (node) => {
      const queryId = createQueryId()
      return baseCtx.compileNode(applyTransformQuery(node, queryId))
    },
    executeNode: async (node, tags?) => {
      const queryId = createQueryId()
      const result = await baseCtx.executeNode(applyTransformQuery(node, queryId), tags)
      return applyExtraTransformResult(result, queryId, plugins)
    },
    executeQuery: async (compiled) => {
      const queryId = createQueryId()
      return applyExtraTransformResult(await baseCtx.executeQuery(compiled), queryId, plugins)
    },
    streamNode: (node, chunkSize, options?, tags?) => {
      const queryId = createQueryId()
      const transformed = applyTransformQuery(node, queryId)
      return (async function*() {
        for await (const chunk of baseCtx.streamNode(transformed, chunkSize, options, tags)) {
          let result: QueryResult<unknown> = chunk
          for (const plugin of plugins) {
            result = await plugin.transformResult({ queryId, result: result as any }) as QueryResult<unknown>
          }
          if (options?.signal?.aborted) {
            throwReasonWithTiming(options.signal.reason, 'during result transformation')
          }
          yield result
        }
      })()
    },
  }
}

// Appends the user-side call stack to errors thrown across the channel boundary.
// Strips node:internal and mocha frames from the tail so the last frame is the caller.
function appendCallStack(error: unknown, callSite: Error): void {
  if (!(error instanceof Error) || !callSite.stack) return
  const frames = callSite.stack.split('\n').slice(1)
  while (frames.length > 0 && isFrameworkFrame(frames[frames.length - 1])) {
    frames.pop()
  }
  if (frames.length > 0) {
    error.stack = (error.stack ?? '') + '\n' + frames.join('\n')
  }
}

function isFrameworkFrame(frame: string): boolean {
  return frame.includes('node:internal') ||
    frame.includes('/node_modules/')
}

// Wraps a query builder: intercepts terminals (execute, compile, etc.) and
// re-wraps structural methods so the chain stays routed through the component.
function wrapBuilder(builder: any, ctx: ApiContext, extraTags?: Set<string>): any {
  return new Proxy(builder, {
    get(target: any, prop: string | symbol) {
      if (prop === 'execute') {
        return async (options?: any) => {
          const callSite = new Error()
          try {
            assertNotAborted(options?.signal, 'before query execution')
            const node = target.toOperationNode()
            const result = await ctx.executeNode(node, extraTags)
            assertNotAborted(options?.signal, 'during result transformation')
            switch (node.kind) {
              case 'InsertQueryNode': return (node as any).returning ? result.rows : new InsertResult(result.insertId, result.numAffectedRows)
              case 'UpdateQueryNode': return (node as any).returning ? result.rows : new UpdateResult(result.numAffectedRows ?? 0n, result.numChangedRows)
              case 'DeleteQueryNode': return (node as any).returning ? result.rows : new DeleteResult(result.numAffectedRows ?? 0n)
              default: return result.rows
            }
          } catch (error) { appendCallStack(error, callSite); throw error }
        }
      }
      if (prop === 'executeTakeFirst') {
        return async (options?: any) => {
          const callSite = new Error()
          try {
            assertNotAborted(options?.signal, 'before query execution')
            const node = target.toOperationNode()
            const result = await ctx.executeNode(node, extraTags)
            assertNotAborted(options?.signal, 'during result transformation')
            if (!(node as any).returning) {
              switch (node.kind) {
                case 'InsertQueryNode': return new InsertResult(result.insertId, result.numAffectedRows)
                case 'UpdateQueryNode': return new UpdateResult(result.numAffectedRows ?? 0n, result.numChangedRows)
                case 'DeleteQueryNode': return new DeleteResult(result.numAffectedRows ?? 0n)
              }
            }
            return result.rows[0] ?? undefined
          } catch (error) { appendCallStack(error, callSite); throw error }
        }
      }
      if (prop === 'executeTakeFirstOrThrow') {
        return async (errorConstructorOrOptions?: any) => {
          const callSite = new Error()
          try {
            let errorConstructor: ((node: any) => Error) | undefined
            let signal: AbortSignal | undefined
            if (typeof errorConstructorOrOptions === 'function') {
              errorConstructor = errorConstructorOrOptions
            } else {
              errorConstructor = errorConstructorOrOptions?.errorConstructor
              signal = errorConstructorOrOptions?.signal
            }
            assertNotAborted(signal, 'before query execution')
            const node = target.toOperationNode()
            const result = await ctx.executeNode(node, extraTags)
            assertNotAborted(signal, 'during result transformation')
            if (!(node as any).returning) {
              switch (node.kind) {
                case 'InsertQueryNode': return new InsertResult(result.insertId, result.numAffectedRows)
                case 'UpdateQueryNode': return new UpdateResult(result.numAffectedRows ?? 0n, result.numChangedRows)
                case 'DeleteQueryNode': return new DeleteResult(result.numAffectedRows ?? 0n)
              }
            }
            if (result.rows.length === 0) {
              const ctor = errorConstructor ?? NoResultError
              const error = isNoResultErrorConstructor(ctor)
                ? new (ctor as any)(node)
                : (ctor as any)(node)
              throw error
            }
            return result.rows[0]
          } catch (error) { appendCallStack(error, callSite); throw error }
        }
      }
      if (prop === 'explain') {
        return async (format?: any, options?: any) => {
          const callSite = new Error()
          try {
            const explainedNode = QueryNode.cloneWithExplain(target.toOperationNode(), format, options)
            const result = await ctx.executeNode(explainedNode as RootOperationNodeRaw, extraTags)
            return result.rows
          } catch (error) { appendCallStack(error, callSite); throw error }
        }
      }
      if (prop === 'compile') {
        return () => ctx.compileNode(target.toOperationNode())
      }
      if (prop === 'stream') {
        return (chunkSizeOrOptions?: any) => {
          const opts: { chunkSize?: number; signal?: AbortSignal } =
            typeof chunkSizeOrOptions !== 'object' ? { chunkSize: chunkSizeOrOptions } : (chunkSizeOrOptions ?? {})
          const chunkSize = opts.chunkSize ?? 100
          const options: AbortableOperationOptions | undefined = opts.signal ? { signal: opts.signal } : undefined
          const node = target.toOperationNode() as RootOperationNodeRaw
          const chunks = ctx.streamNode(node, chunkSize, options, extraTags)
          return (async function*() {
            for await (const chunk of chunks) { yield* chunk.rows }
          })()
        }
      }
      if (prop === 'withPlugin') {
        return (plugin: KyselyPlugin) => wrapBuilder(target, withExtraPlugins(ctx, [plugin]), extraTags)
      }
      if (prop === 'withPlugins') {
        return (plugins: ReadonlyArray<KyselyPlugin>) => wrapBuilder(target, withExtraPlugins(ctx, plugins), extraTags)
      }
      if (prop === 'withPluginAtFront') {
        return (plugin: KyselyPlugin) => wrapBuilder(target, withExtraPlugins(ctx, [plugin]), extraTags)
      }
      const value = target[prop]
      if (typeof value === 'function') {
        return (...args: any[]) => dispatch(value.apply(target, args), ctx, extraTags)
      }
      return dispatch(value, ctx, extraTags)
    },
  })
}

// Wraps a plain module object (SchemaModule, DynamicModule, etc.) so that any
// builder it produces is wired into the component's execution context.
function wrapModule(module: any, ctx: ApiContext, extraTags?: Set<string>): any {
  return new Proxy(module, {
    get(target: any, prop: string | symbol) {
      // Plugin methods on modules (e.g. SchemaModule.withPlugin) must update the
      // execution context — route them through withExtraPlugins rather than
      // letting the module's stub return value determine the new context.
      if (prop === 'withPlugin') {
        return (plugin: KyselyPlugin) => wrapModule(target, withExtraPlugins(ctx, [plugin]), extraTags)
      }
      if (prop === 'withPlugins') {
        return (plugins: ReadonlyArray<KyselyPlugin>) => wrapModule(target, withExtraPlugins(ctx, plugins), extraTags)
      }
      if (prop === 'withoutPlugins') {
        return () => wrapModule(target, withExtraPlugins(ctx, []), extraTags)
      }
      if (prop === 'withSchema') {
        return (schema: string) => wrapModule(target, withExtraPlugins(ctx, [new WithSchemaPlugin(schema)]), extraTags)
      }
      // Proxy invariant: non-configurable, non-writable data properties must
      // return the exact target value. Check before dispatching to avoid the
      // "did not return its actual value" TypeError (e.g. frozen operation nodes).
      const desc = Object.getOwnPropertyDescriptor(target, prop)
      if (desc && !desc.configurable && desc.writable === false) {
        return desc.value
      }
      const value = target[prop]
      if (typeof value === 'function') {
        return (...args: any[]) => dispatch(value.apply(target, args), ctx, extraTags)
      }
      return dispatch(value, ctx, extraTags)
    },
  })
}

// Wraps a callable module (FunctionModule — a function with methods attached).
// The apply trap handles direct calls (fn('custom')); the get trap handles
// property access (fn.avg, fn.count, etc.).
function wrapCallableModule(fn: any, owner: any, ctx: ApiContext, extraTags?: Set<string>): any {
  return new Proxy(fn, {
    apply(_target: any, _thisArg: any, args: any[]) {
      return dispatch(fn.apply(owner, args), ctx, extraTags)
    },
    get(target: any, prop: string | symbol) {
      const desc = Object.getOwnPropertyDescriptor(target, prop)
      if (desc && !desc.configurable && desc.writable === false) {
        return desc.value
      }
      const value = target[prop]
      if (typeof value === 'function') {
        return (...args: any[]) => dispatch(value.apply(target, args), ctx, extraTags)
      }
      return dispatch(value, ctx, extraTags)
    },
  })
}

// Creates the object returned by db.connection() — acquires a single connection
// without transaction SQL, and runs the callback with all queries pinned to it.
function makeConnectionBuilder(builderDb: KyselyBuilder<any>, ctx: ApiContext) {
  const self: any = {
    async execute<T>(callback: (db: any) => Promise<T>, options?: any): Promise<T> {
      const signal: AbortSignal | undefined = options?.signal
      const adapter = ctx.getExecutor().adapter
      const timingName = adapter.supportsMultipleConnections
        ? 'before acquireConnection:acquire'
        : 'before acquireConnection:mutex'
      assertNotAborted(signal, timingName)
      const connId = crypto.randomUUID()
      await ctx.connBegin(connId)
      const connTags = new Set([connId])
      const connDb = createApiObject(builderDb, ctx, connTags)
      try {
        return await callback(connDb)
      } finally {
        await ctx.connEnd(connId)
      }
    },
  }
  return self
}

// Creates the object returned by db.transaction() — mirrors TransactionBuilder.
// connTags: if called inside a .connection() context, passed so the component
// can borrow the existing pinned connection rather than acquiring a new one.
function makeTransactionBuilder(builderDb: KyselyBuilder<any>, ctx: ApiContext, connTags?: Set<string>) {
  const settings: { isolationLevel?: any; accessMode?: any } = {}
  const self: any = {
    setIsolationLevel(level: any) { settings.isolationLevel = level; return self },
    setAccessMode(mode: any)      { settings.accessMode = mode;      return self },
    async execute<T>(callback: (trx: any) => Promise<T>): Promise<T> {
      const txId = crypto.randomUUID()
      await ctx.txBegin({ txId, ...settings }, connTags)
      const { proxy: trx, state: txState } = makeTransaction(txId, builderDb, ctx)
      try {
        const result = await callback(trx)
        txState.committed = true
        await ctx.txCommit(txId)
        return result
      } catch (error) {
        txState.rolledBack = true
        await ctx.txRollback(txId)
        throw error
      }
    },
  }
  return self
}

// Creates the object returned by db.startTransaction() — mirrors ControlledTransactionBuilder.
function makeControlledTransactionBuilder(builderDb: KyselyBuilder<any>, ctx: ApiContext, connTags?: Set<string>) {
  const settings: { isolationLevel?: any; accessMode?: any } = {}
  const self: any = {
    setIsolationLevel(level: any) { settings.isolationLevel = level; return self },
    setAccessMode(mode: any)      { settings.accessMode = mode;      return self },
    async execute(): Promise<any> {
      const txId = crypto.randomUUID()
      await ctx.txBegin({ txId, ...settings }, connTags)
      return makeTransaction(txId, builderDb, ctx).proxy
    },
  }
  return self
}

// Creates the transaction handle passed to the callback (mirrors Transaction<DB>).
// All query execution is tagged with txId so KyselyComponent routes to the pinned connection.
// Adds .commit(), .rollback(), .savepoint(), etc. on top of the base API object.
interface TxHandle {
  proxy: any
  state: { committed: boolean; rolledBack: boolean }
}

function assertTxActive(state: { committed: boolean; rolledBack: boolean }): void {
  if (state.committed) throw new Error('Transaction is already committed')
  if (state.rolledBack) throw new Error('Transaction is already rolled back')
}

function makeTransaction(txId: string, builderDb: KyselyBuilder<any>, ctx: ApiContext): TxHandle {
  const txTags = new Set([txId])
  const state = { committed: false, rolledBack: false }
  // Guard all execution paths so errors are thrown at execute time, not build time.
  const guardedCtx: ApiContext = {
    ...ctx,
    executeNode:  (node, tags?) => { assertTxActive(state); return ctx.executeNode(node, tags) },
    executeQuery: (compiled)    => { assertTxActive(state); return ctx.executeQuery(compiled) },
    compileNode:  (node)        => { assertTxActive(state); return ctx.compileNode(node) },
  }
  const txDb = createApiObject(builderDb, guardedCtx, txTags)
  const txProxy: any = new Proxy(txDb, {
    get(target: any, prop: string | symbol) {
      if (prop === 'isTransaction') return true
      if (prop === 'isCommitted')   return state.committed
      if (prop === 'isRolledBack')  return state.rolledBack
      if (prop === 'commit') {
        return () => ({ execute: async () => { assertTxActive(state); state.committed = true; await ctx.txCommit(txId) } })
      }
      if (prop === 'rollback') {
        return () => ({ execute: async () => { assertTxActive(state); state.rolledBack = true; await ctx.txRollback(txId) } })
      }
      if (prop === 'savepoint') {
        return (name: string) => ({
          execute: async () => { assertTxActive(state); await ctx.savepoint(txId, name); return txProxy },
        })
      }
      if (prop === 'rollbackToSavepoint') {
        return (name: string) => ({ execute: () => { assertTxActive(state); return ctx.rollbackToSavepoint(txId, name) } })
      }
      if (prop === 'releaseSavepoint') {
        return (name: string) => ({ execute: () => { assertTxActive(state); return ctx.releaseSavepoint(txId, name) } })
      }
      return target[prop]
    },
  })
  return { proxy: txProxy, state }
}

// Builds the explicit top-level API object — the replacement for the wrapKysely Proxy.
// All methods are defined directly; no structural fall-through needed at this level.
// extraPlugins are applied as plain functions (transformQuery before send,
// transformResult after receive) per tactic 07 — they never enter KyselyBuilder.
function createApiObject(
  builderDb: KyselyBuilder<any>,
  baseCtx: ApiContext,
  extraTags?: Set<string>,
  extraPlugins?: ReadonlyArray<KyselyPlugin>,
): any {
  const ctx = extraPlugins && extraPlugins.length > 0 ? withExtraPlugins(baseCtx, extraPlugins) : baseCtx

  return {
    // Query entry points — delegate to KyselyBuilder, wrap result for execution routing
    selectFrom:   (table: any)  => wrapBuilder(builderDb.selectFrom(table),   ctx, extraTags),
    selectNoFrom: (sel: any)    => wrapBuilder(builderDb.selectNoFrom(sel),   ctx, extraTags),
    insertInto:   (table: any)  => wrapBuilder(builderDb.insertInto(table),   ctx, extraTags),
    replaceInto:  (table: any)  => wrapBuilder(builderDb.replaceInto(table),  ctx, extraTags),
    updateTable:  (tables: any) => wrapBuilder(builderDb.updateTable(tables), ctx, extraTags),
    deleteFrom:   (from: any)   => wrapBuilder(builderDb.deleteFrom(from),    ctx, extraTags),
    mergeInto:    (table: any)  => wrapBuilder(builderDb.mergeInto(table),    ctx, extraTags),

    // CTE — update the builder and recurse (plugins and tags are inherited)
    with:          (name: any, expr: any) => createApiObject(builderDb.with(name, expr),          baseCtx, extraTags, extraPlugins),
    withRecursive: (name: any, expr: any) => createApiObject(builderDb.withRecursive(name, expr), baseCtx, extraTags, extraPlugins),

    // Sub-modules — delegate to KyselyBuilder, wrap for execution routing
    get schema()  { return wrapModule(builderDb.schema, ctx, extraTags) },
    get fn()      { return wrapCallableModule(builderDb.fn, null, ctx, extraTags) },
    get dynamic() { return wrapModule(builderDb.dynamic, ctx, extraTags) },

    // Plugin/schema accumulation — builderDb is unchanged; plugins accumulate in
    // extraPlugins and are applied as plain functions by withExtraPlugins.
    // withSchema is treated as a plugin (WithSchemaPlugin) per tactic 07.
    withPlugin:        (plugin: KyselyPlugin)                 => createApiObject(builderDb, baseCtx, extraTags, [...(extraPlugins ?? []), plugin]),
    withPlugins:       (plugins: ReadonlyArray<KyselyPlugin>)  => createApiObject(builderDb, baseCtx, extraTags, [...(extraPlugins ?? []), ...plugins]),
    withPluginAtFront: (plugin: KyselyPlugin)                 => createApiObject(builderDb, baseCtx, extraTags, [plugin, ...(extraPlugins ?? [])]),
    withoutPlugins:    ()                                     => createApiObject(builderDb, baseCtx, extraTags, []),
    withSchema:        (schema: string)                       => createApiObject(builderDb, baseCtx, extraTags, [...(extraPlugins ?? []), new WithSchemaPlugin(schema)]),

    // Type-only DB shape manipulation — runtime identity; no structural change.
    withTables:    () => createApiObject(builderDb, baseCtx, extraTags, extraPlugins),
    $extendTables: () => createApiObject(builderDb, baseCtx, extraTags, extraPlugins),
    $omitTables:   () => createApiObject(builderDb, baseCtx, extraTags, extraPlugins),
    $pickTables:   () => createApiObject(builderDb, baseCtx, extraTags, extraPlugins),

    // Component-mediated operations
    destroy:      () => ctx.destroy(),
    executeQuery: (query: CompiledQuery | { compile(): CompiledQuery }) => {
      const compiled = isCompilable(query as any) ? (query as any).compile() : query
      return ctx.getExecutor().executeQuery(compiled as CompiledQuery)
    },
    getExecutor:      ctx.getExecutor,
    transaction:      () => makeTransactionBuilder(builderDb, ctx, extraTags),
    startTransaction: () => makeControlledTransactionBuilder(builderDb, ctx, extraTags),
    connection:       () => makeConnectionBuilder(builderDb, ctx),
    introspection: {
      getTables:  (options?: any) => ctx.getTables(options, extraTags),
      getSchemas: ()              => ctx.getSchemas(extraTags),
    },
    isTransaction: false,
    [Symbol.asyncDispose]: () => ctx.destroy(),
  }
}

function createKyselyInstance(config: ApiConfig): any {
  const dialectConfig = config.dialect.dialectConfig
  const log = config.log

  const DriverClass = dialectConfig
    ? class extends KyselyBuiltinDriverSlot { constructor() { super(dialectConfig!, log) } }
    : class extends KyselyCustomDriverSlot  { constructor() { super(config.dialect, log) } }

  const CompilerClass = dialectConfig
    ? class extends KyselyBuiltinCompilerSlot { constructor() { super(dialectConfig!.dialectName) } }
    : class extends KyselyCustomCompilerSlot  { constructor() { super(config.dialect.createQueryCompiler()) } }

  const component = new KyselyComponent({ DriverClass, CompilerClass, plugins: config.plugins })
  const builderDb = new KyselyBuilder<any>()

  const executeNode  = asAsyncFunction(component.queryIn,    component.resultOut, component.errorOut)
  const executeQuery = asAsyncFunction(component.compiledIn, component.resultOut, component.errorOut)
  const compileNode  = asFunction(component.compileIn, component.compiledOut)
  const _getTables   = asAsyncFunction(component.getTablesIn,  component.tablesOut,  component.errorOut)
  const _getSchemas  = asAsyncFunction(component.getSchemasIn, component.schemasOut, component.errorOut)
  const connBegin    = (connId: string) => component.connectionIn.injectAndWait({ kind: 'begin', connId })
  const connEnd      = (connId: string) => component.connectionIn.injectAndWait({ kind: 'end' }, new Set([connId]))
  const rawStream = asStreamingFunction<StreamStartPayload, QueryResult<unknown>>(
    (p, t) => component.streamIn.inject({ kind: 'start', ...p }, t),
    (t)    => component.streamIn.inject({ kind: 'next' }, t),
    (t)    => component.streamIn.inject({ kind: 'end' }, t),
    component.streamChunkOut,
    component.errorOut,
  )

  // Late-bound: executorShim references ctx, ctx.getExecutor references executorShim.
  let executorShim!: ComponentQueryExecutor

  const ctx: ApiContext = {
    executeNode,
    compileNode,
    executeQuery,
    streamNode: (node, chunkSize, options?, extraTags?) =>
      rawStream(
        (streamId) => ({ streamId, node: node as StreamStartPayload['node'], chunkSize, options }),
        extraTags,
      ),
    getTables:  (options, tags?) => _getTables(options, tags),
    getSchemas: (tags?)         => _getSchemas(undefined as void, tags),
    getExecutor:         () => executorShim,
    destroy:             () => component.destroyIn.injectAndWait(undefined as void),
    txBegin:    (p, connTags?) => component.transactionIn.injectAndWait({ kind: 'begin', ...p }, connTags),
    txCommit:   (txId)   => component.transactionIn.injectAndWait({ kind: 'commit' }, new Set([txId])),
    txRollback: (txId)   => component.transactionIn.injectAndWait({ kind: 'rollback' }, new Set([txId])),
    savepoint:           (txId, name) => component.transactionIn.injectAndWait({ kind: 'savepoint', name }, new Set([txId])),
    rollbackToSavepoint: (txId, name) => component.transactionIn.injectAndWait({ kind: 'rollbackSavepoint', name }, new Set([txId])),
    releaseSavepoint:    (txId, name) => component.transactionIn.injectAndWait({ kind: 'releaseSavepoint', name }, new Set([txId])),
    connBegin,
    connEnd,
  }

  const adapter = dialectConfig ? createAdapter(dialectConfig) : config.dialect.createAdapter()
  executorShim = new ComponentQueryExecutor(ctx, adapter, config.plugins ?? [])

  return createApiObject(builderDb, ctx)
}

// Drop-in replacement for `new Kysely<DB>(config)` from the original package.
// At runtime, `new Kysely<DB>(config)` calls createKyselyInstance, which returns a
// plain object. JavaScript uses that return value as the result of the `new` expression
// (constructors that return an object override the default `this`).
export const Kysely = createKyselyInstance as unknown as new <DB>(
  config: ApiConfig,
) => KyselyPublicType<DB>

// Type companion so `Kysely<DB>` works as a type annotation (mirrors the original
// class, which served as both constructor and instance type).
export type Kysely<DB> = KyselyPublicType<DB>
