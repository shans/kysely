import { ChannelIn, ChannelOut } from '../../../channels/channel.js'
import type { KyselyPlugin } from '../../../types/plugin/kysely-plugin.js'
import type { PluginQueryArgs, PluginResultArgs, TransformedQueryResult, RootOperationNodeRaw } from '../../../types/plugin-types.js'
import type { QueryResult } from '../../../types/driver/database-connection.js'
import type { UnknownRow } from '../../../types/util/type-utils.js'
import { KyselyPluginShape } from './KyselyPluginShape.js'

// Wraps one KyselyPlugin in the component model.
export class KyselyPluginComponent extends KyselyPluginShape {
  readonly transformQueryIn = new ChannelIn<PluginQueryArgs>(this, this.handleTransformQuery)
  readonly transformQueryOut = new ChannelOut<TransformedQueryResult>()
  readonly transformResultIn = new ChannelIn<PluginResultArgs>(this, this.handleTransformResult)
  readonly transformResultOut = new ChannelOut<QueryResult<UnknownRow>>()
  readonly transformStreamResultIn = new ChannelIn<PluginResultArgs>(this, this.handleTransformStreamResult)
  readonly transformStreamResultOut = new ChannelOut<QueryResult<UnknownRow>>()
  readonly errorOut = new ChannelOut<unknown>()

  constructor(private readonly plugin: KyselyPlugin) { super() }

  // No try/catch: sync throws propagate back through the channel send chain to
  // KyselyEntryComponent's handler which catches and routes to errorOut.
  private handleTransformQuery({ node, queryId, streamMeta }: PluginQueryArgs): void {
    this.transformQueryOut.send({
      node: this.plugin.transformQuery({ node: node as any, queryId }) as RootOperationNodeRaw,
      queryId,
      streamMeta,
    })
  }

  private async handleTransformResult({ result, queryId }: PluginResultArgs): Promise<void> {
    try {
      const transformed = await this.plugin.transformResult({ queryId, result: result as any })
      this.transformResultOut.send(transformed as QueryResult<UnknownRow>)
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  private async handleTransformStreamResult({ result, queryId }: PluginResultArgs): Promise<void> {
    try {
      const transformed = await this.plugin.transformResult({ queryId, result: result as any })
      this.transformStreamResultOut.send(transformed as QueryResult<UnknownRow>)
    } catch (error) {
      this.errorOut.send(error)
    }
  }
}
