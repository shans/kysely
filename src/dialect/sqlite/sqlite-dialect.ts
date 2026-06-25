import type { Driver } from '../../shared/driver/driver.js'
import type { Kysely } from '../../transaction-types.js'
import type { QueryCompiler } from '../../types/query-compiler/query-compiler.js'
import type { Dialect } from '../../types/dialect/dialect.js'
import type { DatabaseIntrospector } from '../../types/dialect/database-introspector.js'
import { SqliteDriver } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/sqlite-driver.js'
import { SqliteQueryCompiler } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/sqlite-query-compiler.js'
import { SqliteIntrospector } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/sqlite-introspector.js'
import type { DialectAdapter } from '../../types/dialect/dialect-adapter.js'
import { SqliteAdapter } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/sqlite-adapter.js'
import type { SqliteDialectConfig } from '../../types/dialect/sqlite-dialect-config.js'
import type { KyselyDialectConfig } from '../../types/dialect/dialect-config.js'
import { freeze } from '../../util/object-utils.js'

/**
 * SQLite dialect that uses the [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3) library.
 *
 * The constructor takes an instance of {@link SqliteDialectConfig}.
 *
 * ```ts
 * import Database from 'better-sqlite3'
 *
 * new SqliteDialect({
 *   database: new Database('db.sqlite')
 * })
 * ```
 *
 * If you want the pool to only be created once it's first used, `database`
 * can be a function:
 *
 * ```ts
 * import Database from 'better-sqlite3'
 *
 * new SqliteDialect({
 *   database: async () => new Database('db.sqlite')
 * })
 * ```
 */
export class SqliteDialect implements Dialect {
  readonly #config: SqliteDialectConfig

  constructor(config: SqliteDialectConfig) {
    this.#config = freeze({ ...config })
  }

  get dialectConfig(): KyselyDialectConfig | undefined {
    if (Object.getPrototypeOf(this) !== SqliteDialect.prototype) return undefined
    return { dialectName: 'sqlite', ...this.#config }
  }

  createDriver(): Driver {
    return new SqliteDriver(this.#config)
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler()
  }

  createAdapter(): DialectAdapter {
    return new SqliteAdapter()
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SqliteIntrospector(db)
  }
}
