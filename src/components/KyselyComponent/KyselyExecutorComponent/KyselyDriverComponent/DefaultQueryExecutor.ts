import type { ConnectionProvider } from '../../../../types/driver/connection-provider.js'
import type { DatabaseConnection } from '../../../../types/driver/database-connection.js'
import type { CompiledQuery } from '../../../../types/query-compiler/compiled-query.js'
import type { QueryCompiler } from '../../../../types/query-compiler/query-compiler.js'
import type { KyselyPlugin } from '../../../../types/plugin/kysely-plugin.js'
import { QueryExecutorBase } from '../../../../shared/query-executor/query-executor-base.js'
import type { DialectAdapter } from '../../../../types/dialect/dialect-adapter.js'
import type { QueryId } from '../../../../types/util/query-id.js'
import type { RootOperationNode } from '../../../../shared/operation-node/root-operation-node.js'
import type { AbortableOperationOptions } from '../../../../types/util/abort.js'

export class DefaultQueryExecutor extends QueryExecutorBase {
  #compiler: QueryCompiler
  #adapter: DialectAdapter
  #connectionProvider: ConnectionProvider

  constructor(
    compiler: QueryCompiler,
    adapter: DialectAdapter,
    connectionProvider: ConnectionProvider,
    plugins: KyselyPlugin[] = [],
  ) {
    super(plugins)

    this.#compiler = compiler
    this.#adapter = adapter
    this.#connectionProvider = connectionProvider
  }

  get adapter(): DialectAdapter {
    return this.#adapter
  }

  compileQuery(node: RootOperationNode, queryId: QueryId): CompiledQuery {
    return this.#compiler.compileQuery(node, queryId)
  }

  provideConnection<T>(
    consumer: (connection: DatabaseConnection) => Promise<T>,
    options?: AbortableOperationOptions,
  ): Promise<T> {
    return this.#connectionProvider.provideConnection(consumer, options)
  }

  withPlugins(plugins: ReadonlyArray<KyselyPlugin>): DefaultQueryExecutor {
    return new DefaultQueryExecutor(
      this.#compiler,
      this.#adapter,
      this.#connectionProvider,
      [...this.plugins, ...plugins],
    )
  }

  withPlugin(plugin: KyselyPlugin): DefaultQueryExecutor {
    return new DefaultQueryExecutor(
      this.#compiler,
      this.#adapter,
      this.#connectionProvider,
      [...this.plugins, plugin],
    )
  }

  withPluginAtFront(plugin: KyselyPlugin): DefaultQueryExecutor {
    return new DefaultQueryExecutor(
      this.#compiler,
      this.#adapter,
      this.#connectionProvider,
      [plugin, ...this.plugins],
    )
  }

  withConnectionProvider(
    connectionProvider: ConnectionProvider,
  ): DefaultQueryExecutor {
    return new DefaultQueryExecutor(
      this.#compiler,
      this.#adapter,
      connectionProvider,
      [...this.plugins],
    )
  }

  withoutPlugins(): DefaultQueryExecutor {
    return new DefaultQueryExecutor(
      this.#compiler,
      this.#adapter,
      this.#connectionProvider,
      [],
    )
  }
}
