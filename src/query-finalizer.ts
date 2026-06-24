import type { OperationNodeSource } from './operation-node/operation-node-source.js'
import type { OperationNode } from './operation-node/operation-node.js'
import type { RootOperationNode } from './operation-node/root-operation-node.js'
import { freeze } from './util/object-utils.js'
import type { Compilable } from './util/compilable.js'
import type { AbortableQueryOptions } from './shared/util/abort.js'

export class QueryFinalizer<N extends RootOperationNode>
  implements OperationNodeSource
{
  readonly #props: QueryFinalizerProps<N>

  constructor(props: QueryFinalizerProps<N>) {
    this.#props = freeze(props)
  }

  toOperationNode(): N {
    return this.#props.node
  }
}

export interface QueryFinalizerProps<N extends OperationNode> {
  readonly node: N
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface QueryFinalizer<N extends RootOperationNode> extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
