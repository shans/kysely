import { ChannelIn, ChannelOut, asFunction, asAsyncFunction } from '../../../channels/channel.js'
import type { PluginQueryArgs, PluginResultArgs, TransformedQueryResult } from '../../../types/plugin-types.js'
import type { QueryResult } from '../../../types/driver/database-connection.js'
import type { UnknownRow } from '../../../types/util/type-utils.js'
import { KyselyPluginShape } from './KyselyPluginShape.js'

// Chains N KyselyPluginShape components in series. With 0 plugins acts as a no-op.
// Uses asFunction/asAsyncFunction at construction time so the wiring is static.
export class CompositeKyselyPluginComponent extends KyselyPluginShape {
  readonly transformQueryIn = new ChannelIn<PluginQueryArgs>(this, this.handleTransformQuery)
  readonly transformQueryOut = new ChannelOut<TransformedQueryResult>()
  readonly transformResultIn = new ChannelIn<PluginResultArgs>(this, this.handleTransformResult)
  readonly transformResultOut = new ChannelOut<QueryResult<UnknownRow>>()
  readonly transformStreamResultIn = new ChannelIn<PluginResultArgs>(this, this.handleTransformStreamResult)
  readonly transformStreamResultOut = new ChannelOut<QueryResult<UnknownRow>>()
  readonly errorOut = new ChannelOut<unknown>()

  private readonly queryFns: ReadonlyArray<(args: PluginQueryArgs) => TransformedQueryResult>
  private readonly resultFns: ReadonlyArray<(args: PluginResultArgs) => Promise<QueryResult<UnknownRow>>>
  private readonly streamResultFns: ReadonlyArray<(args: PluginResultArgs) => Promise<QueryResult<UnknownRow>>>

  constructor(plugins: readonly KyselyPluginShape[]) {
    super()
    this.queryFns = plugins.map((p) => asFunction(p.transformQueryIn, p.transformQueryOut))
    // Pass each plugin's errorOut so asAsyncFunction can reject the promise on error.
    this.resultFns = plugins.map((p) => asAsyncFunction(p.transformResultIn, p.transformResultOut, p.errorOut))
    this.streamResultFns = plugins.map((p) => asAsyncFunction(p.transformStreamResultIn, p.transformStreamResultOut, p.errorOut))
  }

  // No try/catch: sync errors from asFunction propagate to the caller.
  private handleTransformQuery({ node, queryId, streamMeta }: PluginQueryArgs): void {
    let currentNode = node
    for (const fn of this.queryFns) {
      currentNode = fn({ node: currentNode, queryId, streamMeta }).node
    }
    this.transformQueryOut.send({ node: currentNode, queryId, streamMeta })
  }

  private async handleTransformResult({ result, queryId }: PluginResultArgs): Promise<void> {
    try {
      let current: QueryResult<UnknownRow> = result
      for (const fn of this.resultFns) {
        current = await fn({ result: current, queryId })
      }
      this.transformResultOut.send(current)
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  private async handleTransformStreamResult({ result, queryId }: PluginResultArgs): Promise<void> {
    try {
      let current: QueryResult<UnknownRow> = result
      for (const fn of this.streamResultFns) {
        current = await fn({ result: current, queryId })
      }
      this.transformStreamResultOut.send(current)
    } catch (error) {
      this.errorOut.send(error)
    }
  }
}
