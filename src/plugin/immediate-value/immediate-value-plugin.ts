import type { QueryResult } from '../../types/driver/database-connection.js'
import type { RootOperationNode } from '../../shared/operation-node/root-operation-node.js'
import type { UnknownRow } from '../../types/util/type-utils.js'
import type {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
} from '../../types/plugin/kysely-plugin.js'
import { ImmediateValueTransformer } from './immediate-value-transformer.js'

/**
 * Transforms all ValueNodes to immediate.
 *
 * WARNING! This should never be part of the public API. Users should never use this.
 * This is an internal helper.
 *
 * @internal
 */
export class ImmediateValuePlugin implements KyselyPlugin {
  readonly #transformer = new ImmediateValueTransformer()

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.#transformer.transformNode(args.node, args.queryId)
  }

  transformResult(
    args: PluginTransformResultArgs,
  ): Promise<QueryResult<UnknownRow>> {
    return Promise.resolve(args.result)
  }
}
