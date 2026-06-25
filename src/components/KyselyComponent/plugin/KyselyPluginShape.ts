import { ChannelIn, ChannelOut, Component } from '../../../channels/channel.js'
import type { PluginQueryArgs, PluginResultArgs, TransformedQueryResult } from '../../../types/plugin-types.js'
import type { QueryResult } from '../../../types/driver/database-connection.js'
import type { UnknownRow } from '../../../types/util/type-utils.js'

// Abstract base for all plugin components. Extends Component so ComponentHole
// can use it as its type parameter (C extends Component).
export abstract class KyselyPluginShape extends Component {
  abstract readonly transformQueryIn: ChannelIn<PluginQueryArgs>
  abstract readonly transformQueryOut: ChannelOut<TransformedQueryResult>
  abstract readonly transformResultIn: ChannelIn<PluginResultArgs>
  abstract readonly transformResultOut: ChannelOut<QueryResult<UnknownRow>>
  // Separate path for stream chunk results — same plugin method, distinct channels
  // so stream chunks can be re-wrapped and routed to streamChunkOut, not resultOut.
  abstract readonly transformStreamResultIn: ChannelIn<PluginResultArgs>
  abstract readonly transformStreamResultOut: ChannelOut<QueryResult<UnknownRow>>
  // Async errors from either transformResult path propagate here.
  abstract readonly errorOut: ChannelOut<unknown>
}
