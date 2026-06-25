import type { CompiledQuery } from '../../../../types/query-compiler/compiled-query.js'
import type { QueryCompiler } from '../../../../types/query-compiler/query-compiler.js'
import type { TransformedQueryResult } from '../../../../types/plugin-types.js'
import { ChannelIn, ChannelOut } from '../../../../channels/channel.js'
import { KyselyCompilerShape } from './KyselyCompilerShape.js'

export class KyselyCustomCompilerSlot extends KyselyCompilerShape {
  readonly in       = new ChannelIn<TransformedQueryResult>(this, this.handle)
  readonly out      = new ChannelOut<CompiledQuery>()
  readonly errorOut = new ChannelOut<unknown>()

  constructor(private readonly compiler: QueryCompiler) { super() }

  private handle({ node, queryId }: TransformedQueryResult): void {
    try {
      this.out.send(this.compiler.compileQuery(node, queryId))
    } catch (error) {
      this.errorOut.send(error)
    }
  }
}
