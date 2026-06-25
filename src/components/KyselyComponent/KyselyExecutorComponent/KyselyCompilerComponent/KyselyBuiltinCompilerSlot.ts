import type { CompiledQuery } from '../../../../types/query-compiler/compiled-query.js'
import type { QueryCompiler } from '../../../../types/query-compiler/query-compiler.js'
import type { TransformedQueryResult } from '../../../../types/plugin-types.js'
import type { DialectName } from '../../../../types/dialect/dialect-config.js'
import { ChannelIn, ChannelOut } from '../../../../channels/channel.js'
import { KyselyCompilerShape } from './KyselyCompilerShape.js'
import { SqliteQueryCompiler } from './sqlite-query-compiler.js'
import { PostgresQueryCompiler } from './postgres-query-compiler.js'
import { MysqlQueryCompiler } from './mysql-query-compiler.js'
import { MssqlQueryCompiler } from './mssql-query-compiler.js'

function createQueryCompiler(dialectName: DialectName): QueryCompiler {
  switch (dialectName) {
    case 'sqlite':   return new SqliteQueryCompiler()
    case 'postgres': return new PostgresQueryCompiler()
    case 'mysql':    return new MysqlQueryCompiler()
    case 'mssql':    return new MssqlQueryCompiler()
    case 'pglite':   return new PostgresQueryCompiler()
  }
}

export class KyselyBuiltinCompilerSlot extends KyselyCompilerShape {
  readonly in       = new ChannelIn<TransformedQueryResult>(this, this.handle)
  readonly out      = new ChannelOut<CompiledQuery>()
  readonly errorOut = new ChannelOut<unknown>()

  private readonly compiler: QueryCompiler

  constructor(dialectName: DialectName) {
    super()
    this.compiler = createQueryCompiler(dialectName)
  }

  private handle({ node, queryId }: TransformedQueryResult): void {
    try {
      this.out.send(this.compiler.compileQuery(node, queryId))
    } catch (error) {
      this.errorOut.send(error)
    }
  }
}
