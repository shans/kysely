import type { QueryResult } from '../../types/driver/database-connection.js'
import { WithSchemaTransformer } from './with-schema-transformer.js'
import type {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
} from '../../types/plugin/kysely-plugin.js'
import type { UnknownRow } from '../../types/util/type-utils.js'
import type { RootOperationNode } from '../../shared/operation-node/root-operation-node.js'

export class WithSchemaPlugin implements KyselyPlugin {
  readonly #transformer: WithSchemaTransformer

  constructor(schema: string) {
    this.#transformer = new WithSchemaTransformer(schema)
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.#transformer.transformNode(args.node, args.queryId)
  }

  async transformResult(
    args: PluginTransformResultArgs,
  ): Promise<QueryResult<UnknownRow>> {
    return args.result
  }
}
