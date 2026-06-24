import type { OperationNodeSource } from '../operation-node/operation-node-source.js'
import { freeze } from '../util/object-utils.js'
import { DropViewNode } from '../operation-node/drop-view-node.js'
import type { Compilable } from '../util/compilable.js'
import type { AbortableQueryOptions } from '../shared/util/abort.js'

export class DropViewBuilder implements OperationNodeSource {
  readonly #props: DropViewBuilderProps

  constructor(props: DropViewBuilderProps) {
    this.#props = freeze(props)
  }

  materialized(): DropViewBuilder {
    return new DropViewBuilder({
      ...this.#props,
      node: DropViewNode.cloneWith(this.#props.node, {
        materialized: true,
      }),
    })
  }

  ifExists(): DropViewBuilder {
    return new DropViewBuilder({
      ...this.#props,
      node: DropViewNode.cloneWith(this.#props.node, {
        ifExists: true,
      }),
    })
  }

  cascade(): DropViewBuilder {
    return new DropViewBuilder({
      ...this.#props,
      node: DropViewNode.cloneWith(this.#props.node, {
        cascade: true,
      }),
    })
  }

  /**
   * Simply calls the provided function passing `this` as the only argument. `$call` returns
   * what the provided function returns.
   */
  $call<T>(func: (qb: this) => T): T {
    return func(this)
  }

  toOperationNode(): DropViewNode {
    return this.#props.node
  }
}

export interface DropViewBuilderProps {
  readonly node: DropViewNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface DropViewBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
