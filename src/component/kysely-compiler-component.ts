import type { CompiledQuery } from '../query-compiler/compiled-query.js'
import type { QueryId } from '../util/query-id.js'
import type { RootOperationNodeRaw } from './root-operation-node.js'
import type { TransformedQueryResult } from './plugin-component.js'
import { ChannelIn, ChannelOut, Component } from '../channels/channel.js'

export class KyselyCompilerComponent extends Component {
  readonly in       = new ChannelIn<TransformedQueryResult>(this, this.handle)
  readonly out      = new ChannelOut<CompiledQuery>()
  readonly errorOut = new ChannelOut<unknown>()

  constructor(
    private readonly compileQueryFn: (node: RootOperationNodeRaw, queryId: QueryId) => CompiledQuery,
  ) {
    super()
  }

  private handle({ node, queryId }: TransformedQueryResult): void {
    try {
      this.out.send(this.compileQueryFn(node, queryId))
    } catch (error) {
      this.errorOut.send(error)
    }
  }
}
