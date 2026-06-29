import type { Driver } from '../../../types/driver/driver.js'
import type { Kysely } from '../../../types/transaction-types.js'
import type { QueryCompiler } from '../../../types/query-compiler/query-compiler.js'
import type { DatabaseIntrospector } from '../../../types/dialect/database-introspector.js'
import type { DialectAdapter } from '../../../types/dialect/dialect-adapter.js'
import type { Dialect } from '../../../types/dialect/dialect.js'
import { MssqlAdapter } from '../../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mssql-adapter.js'
import type { MssqlDialectConfig } from '../../../types/dialect/mssql-dialect-config.js'
import { MssqlDriver } from '../../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mssql-driver.js'
import { MssqlIntrospector } from '../../../components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mssql-introspector.js'
import { MssqlQueryCompiler } from '../../../components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/mssql-query-compiler.js'

/**
 * MS SQL Server dialect that uses the [tedious](https://tediousjs.github.io/tedious)
 * library.
 *
 * The constructor takes an instance of {@link MssqlDialectConfig}.
 *
 * ```ts
 * import * as Tedious from 'tedious'
 * import * as Tarn from 'tarn'
 *
 * const dialect = new MssqlDialect({
 *   tarn: {
 *     ...Tarn,
 *     options: {
 *       min: 0,
 *       max: 10,
 *     },
 *   },
 *   tedious: {
 *     ...Tedious,
 *     connectionFactory: () => new Tedious.Connection({
 *       authentication: {
 *         options: {
 *           password: 'password',
 *           userName: 'username',
 *         },
 *         type: 'default',
 *       },
 *       options: {
 *         database: 'some_db',
 *         port: 1433,
 *         trustServerCertificate: true,
 *       },
 *       server: 'localhost',
 *     }),
 *   },
 * })
 * ```
 */
export class MssqlDialect implements Dialect {
  readonly #config: MssqlDialectConfig

  constructor(config: MssqlDialectConfig) {
    this.#config = config
  }

  createDriver(): Driver {
    return new MssqlDriver(this.#config)
  }

  createQueryCompiler(): QueryCompiler {
    return new MssqlQueryCompiler()
  }

  createAdapter(): DialectAdapter {
    return new MssqlAdapter()
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new MssqlIntrospector(db)
  }
}
