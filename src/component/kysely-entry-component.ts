import type { RootOperationNode } from '../operation-node/root-operation-node.js'
import { ChannelIn, ChannelOut, Component } from '../channels/channel.js'
import { createQueryId } from '../util/query-id.js'
import type { PluginQueryArgs } from './plugin-component.js'
import type { StreamStartPayload } from './kysely-component.js'

// Receives raw query inputs from the API layer, creates queryIds, and emits
// typed PluginQueryArgs on separate output channels — one per action type —
// so KyselyComponent can route them through the plugin hole with tagged wiring.
//
// Sync plugin errors thrown during transformQuery propagate back through the
// send chain to each handler's try/catch and are emitted on errorOut.
export class KyselyEntryComponent extends Component {
  readonly queryIn        = new ChannelIn<RootOperationNode>(this, this.handleQuery)
  readonly compileIn      = new ChannelIn<RootOperationNode>(this, this.handleCompile)
  readonly streamStartIn  = new ChannelIn<StreamStartPayload>(this, this.handleStreamStart)

  // Separate outputs per action so KyselyComponent can wire them with
  // connectTagged and connectFiltered for routing through the plugin hole.
  readonly executeQueryOut = new ChannelOut<PluginQueryArgs>()
  readonly compileQueryOut = new ChannelOut<PluginQueryArgs>()
  readonly streamQueryOut  = new ChannelOut<PluginQueryArgs>()
  readonly errorOut        = new ChannelOut<unknown>()

  private handleQuery(node: RootOperationNode): void {
    try {
      this.executeQueryOut.send({ node, queryId: createQueryId() })
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  private handleCompile(node: RootOperationNode): void {
    try {
      this.compileQueryOut.send({ node, queryId: createQueryId() })
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  private handleStreamStart({ streamId, node, chunkSize, options }: StreamStartPayload): void {
    try {
      this.streamQueryOut.send({
        node,
        queryId: createQueryId(),
        streamMeta: { streamId, chunkSize, options },
      })
    } catch (error) {
      this.errorOut.send(error)
    }
  }
}
