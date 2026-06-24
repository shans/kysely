import type { QueryResult } from '../types/driver/database-connection.js'
import type { RootOperationNode } from '../operation-node/root-operation-node.js'
import type { UnknownRow } from '../types/util/type-utils.js'
import type {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
} from '../types/plugin/kysely-plugin.js'

export class NoopPlugin implements KyselyPlugin {
  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return args.node
  }

  async transformResult(
    args: PluginTransformResultArgs,
  ): Promise<QueryResult<UnknownRow>> {
    return args.result
  }
}
