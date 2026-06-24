import { DropTypeNode } from '../operation-node/drop-type-node.js'
import type { OperationNodeSource } from '../operation-node/operation-node-source.js'
import { freeze } from '../util/object-utils.js'
import type { Compilable } from '../util/compilable.js'
import type { AbortableQueryOptions } from '../shared/util/abort.js'

export class DropTypeBuilder implements OperationNodeSource {
  readonly #props: DropTypeBuilderProps

  constructor(props: DropTypeBuilderProps) {
    this.#props = freeze(props)
  }

  /**
   * Adds `if exists` to the query.
   */
  ifExists(): DropTypeBuilder {
    return new DropTypeBuilder({
      ...this.#props,
      node: DropTypeNode.cloneWith(this.#props.node, {
        ifExists: true,
      }),
    })
  }

  /**
   * Adds `cascade` to the query.
   */
  cascade(): DropTypeBuilder {
    return new DropTypeBuilder({
      ...this.#props,
      node: DropTypeNode.cloneWith(this.#props.node, {
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

  toOperationNode(): DropTypeNode {
    return this.#props.node
  }
}

export interface DropTypeBuilderProps {
  readonly node: DropTypeNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface DropTypeBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
