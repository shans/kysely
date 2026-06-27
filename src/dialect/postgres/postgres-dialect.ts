import type { Driver } from '../../types/driver/driver.js'
import type { Kysely } from '../../transaction-types.js'
import type { QueryCompiler } from '../../types/query-compiler/query-compiler.js'
import type { Dialect } from '../../types/dialect/dialect.js'
import { PostgresDriver } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/postgres-driver.js'
import type { DatabaseIntrospector } from '../../types/dialect/database-introspector.js'
import { PostgresIntrospector } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/postgres-introspector.js'
import { PostgresQueryCompiler } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/postgres-query-compiler.js'
import type { DialectAdapter } from '../../types/dialect/dialect-adapter.js'
import { PostgresAdapter } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/postgres-adapter.js'
import type { PostgresDialectConfig } from '../../types/dialect/postgres-dialect-config.js'
import type { KyselyDialectConfig } from '../../types/dialect/dialect-config.js'

/**
 * PostgreSQL dialect that uses the [pg](https://node-postgres.com/) library.
 *
 * The constructor takes an instance of {@link PostgresDialectConfig}.
 *
 * ```ts
 * import { Pool } from 'pg'
 *
 * new PostgresDialect({
 *   pool: new Pool({
 *     database: 'some_db',
 *     host: 'localhost',
 *   })
 * })
 * ```
 *
 * If you want the pool to only be created once it's first used, `pool`
 * can be a function:
 *
 * ```ts
 * import { Pool } from 'pg'
 *
 * new PostgresDialect({
 *   pool: async () => new Pool({
 *     database: 'some_db',
 *     host: 'localhost',
 *   })
 * })
 * ```
 */
export class PostgresDialect implements Dialect {
  readonly #config: PostgresDialectConfig

  constructor(config: PostgresDialectConfig) {
    this.#config = config
  }

  get dialectConfig(): KyselyDialectConfig | undefined {
    if (Object.getPrototypeOf(this) !== PostgresDialect.prototype) return undefined
    return { dialectName: 'postgres', ...this.#config }
  }

  createDriver(): Driver {
    return new PostgresDriver(this.#config)
  }

  createQueryCompiler(): QueryCompiler {
    return new PostgresQueryCompiler()
  }

  createAdapter(): DialectAdapter {
    return new PostgresAdapter()
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new PostgresIntrospector(db)
  }
}
