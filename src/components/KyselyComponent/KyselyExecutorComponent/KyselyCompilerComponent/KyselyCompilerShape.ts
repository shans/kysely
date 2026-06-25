import { ChannelIn, ChannelOut, Component } from '../../../../channels/channel.js'
import type { CompiledQuery } from '../../../../types/query-compiler/compiled-query.js'
import type { TransformedQueryResult } from '../../../../types/plugin-types.js'

export abstract class KyselyCompilerShape extends Component {
  abstract readonly in: ChannelIn<TransformedQueryResult>
  abstract readonly out: ChannelOut<CompiledQuery>
  abstract readonly errorOut: ChannelOut<unknown>
}
