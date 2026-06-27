import type { Driver } from '../../types/driver/driver.js'
import type { Kysely } from '../../transaction-types.js'
import type { QueryCompiler } from '../../types/query-compiler/query-compiler.js'
import type { Dialect } from '../../types/dialect/dialect.js'
import type { DatabaseIntrospector } from '../../types/dialect/database-introspector.js'
import { MysqlDriver } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mysql-driver.js'
import { MysqlQueryCompiler } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/mysql-query-compiler.js'
import { MysqlIntrospector } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mysql-introspector.js'
import type { DialectAdapter } from '../../types/dialect/dialect-adapter.js'
import { MysqlAdapter } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mysql-adapter.js'
import type { MysqlDialectConfig } from '../../types/dialect/mysql-dialect-config.js'
import type { KyselyDialectConfig } from '../../types/dialect/dialect-config.js'

/**
 * MySQL dialect that uses the [mysql2](https://github.com/sidorares/node-mysql2#readme) library.
 *
 * The constructor takes an instance of {@link MysqlDialectConfig}.
 *
 * ```ts
 * import { createPool } from 'mysql2'
 *
 * new MysqlDialect({
 *   pool: createPool({
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
 * import { createPool } from 'mysql2'
 *
 * new MysqlDialect({
 *   pool: async () => createPool({
 *     database: 'some_db',
 *     host: 'localhost',
 *   })
 * })
 * ```
 */
export class MysqlDialect implements Dialect {
  readonly #config: MysqlDialectConfig

  constructor(config: MysqlDialectConfig) {
    this.#config = config
  }

  get dialectConfig(): KyselyDialectConfig | undefined {
    if (Object.getPrototypeOf(this) !== MysqlDialect.prototype) return undefined
    return { dialectName: 'mysql', ...this.#config }
  }

  createDriver(): Driver {
    return new MysqlDriver(this.#config)
  }

  createQueryCompiler(): QueryCompiler {
    return new MysqlQueryCompiler()
  }

  createAdapter(): DialectAdapter {
    return new MysqlAdapter()
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new MysqlIntrospector(db)
  }
}
