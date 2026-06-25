import type { SqliteDialectConfig } from './sqlite-dialect-config.js'
import type { PostgresDialectConfig } from './postgres-dialect-config.js'
import type { MysqlDialectConfig } from './mysql-dialect-config.js'
import type { MssqlDialectConfig } from './mssql-dialect-config.js'
import type { PGliteDialectConfig } from './pglite-dialect-config.js'

export type DialectName = 'sqlite' | 'postgres' | 'mysql' | 'mssql' | 'pglite'

export type KyselyDialectConfig =
  | ({ readonly dialectName: 'sqlite'   } & SqliteDialectConfig)
  | ({ readonly dialectName: 'postgres' } & PostgresDialectConfig)
  | ({ readonly dialectName: 'mysql'    } & MysqlDialectConfig)
  | ({ readonly dialectName: 'mssql'    } & MssqlDialectConfig)
  | ({ readonly dialectName: 'pglite'   } & PGliteDialectConfig)
