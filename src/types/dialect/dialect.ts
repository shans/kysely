import type { Driver } from '../driver/driver.js'
import type { Kysely } from '../transaction-types.js'
import type { QueryCompiler } from '../query-compiler/query-compiler.js'
import type { DatabaseIntrospector } from './database-introspector.js'
import type { DialectAdapter } from './dialect-adapter.js'
import type { KyselyDialectConfig } from './dialect-config.js'

/**
 * A Dialect is the glue between Kysely and the underlying database engine.
 *
 * See the built-in {@link PostgresDialect} as an example of a dialect.
 * Users can implement their own dialects and use them by passing it
 * in the {@link KyselyConfig.dialect} property.
 */
export interface Dialect {
  /**
   * Returns the dialect's configuration as a plain tagged-union value.
   * Built-in dialects provide this so the component system can instantiate
   * implementations internally. Custom dialects may omit it — the component
   * system falls back to calling the factory methods (createDriver etc.) in
   * that case.
   */
  readonly dialectConfig?: KyselyDialectConfig

  /**
   * Creates a driver for the dialect.
   */
  createDriver(): Driver

  /**
   * Creates a query compiler for the dialect.
   */
  createQueryCompiler(): QueryCompiler

  /**
   * Creates an adapter for the dialect.
   */
  createAdapter(): DialectAdapter

  /**
   * Creates a database introspector that can be used to get database metadata
   * such as the table names and column names of those tables.
   *
   * `db` never has any plugins installed. It's created using
   * {@link Kysely.withoutPlugins}.
   */
  createIntrospector(db: Kysely<any>): DatabaseIntrospector
}
