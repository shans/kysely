import type { Driver } from '../../types/driver/driver.js'
import type { Kysely } from '../../types/transaction-types.js'
import type { QueryCompiler } from '../../types/query-compiler/query-compiler.js'
import type { DatabaseIntrospector } from '../../types/dialect/database-introspector.js'
import type { DialectAdapter } from '../../types/dialect/dialect-adapter.js'
import type { Dialect } from '../../types/dialect/dialect.js'
import { PostgresIntrospector } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/postgres-introspector.js'
import { PostgresQueryCompiler } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/postgres-query-compiler.js'
import { PGliteAdapter } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/pglite-adapter.js'
import type { PGliteDialectConfig } from '../../types/dialect/pglite-dialect-config.js'
import type { KyselyDialectConfig } from '../../types/dialect/dialect-config.js'
import { PGliteDriver } from '../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/pglite-driver.js'

/**
 * PGlite dialect.
 *
 * The constructor takes an instance of {@link PGliteDialectConfig}.
 *
 * ```ts
 * import { PGlite } from '@electric-sql/pglite'
 *
 * new PGliteDialect({
 *   pglite: new PGlite()
 * })
 * ```
 *
 * If you want the client to only be created once it's first used, `pglite`
 * can be a function:
 *
 * ```ts
 * import { PGlite } from '@electric-sql/pglite'
 *
 * new PGliteDialect({
 *   pglite: () => new PGlite()
 * })
 * ```
 */
export class PGliteDialect implements Dialect {
  readonly #config: PGliteDialectConfig

  constructor(config: PGliteDialectConfig) {
    this.#config = config
  }

  get dialectConfig(): KyselyDialectConfig | undefined {
    if (Object.getPrototypeOf(this) !== PGliteDialect.prototype) return undefined
    return { dialectName: 'pglite', ...this.#config }
  }

  createAdapter(): DialectAdapter {
    return new PGliteAdapter()
  }

  createDriver(): Driver {
    return new PGliteDriver(this.#config)
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new PostgresIntrospector(db)
  }

  createQueryCompiler(): QueryCompiler {
    return new PostgresQueryCompiler()
  }
}
