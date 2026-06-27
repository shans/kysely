import type { OperationNodeSource } from '../shared/operation-node/operation-node-source.js'
import { freeze } from '../util/object-utils.js'
import { CreateTypeNode } from '../shared/operation-node/create-type-node.js'
import type { Compilable } from '../util/compilable.js'
import type { AbortableQueryOptions } from '../types/util/abort.js'

export class CreateTypeBuilder implements OperationNodeSource {
  readonly #props: CreateTypeBuilderProps

  constructor(props: CreateTypeBuilderProps) {
    this.#props = freeze(props)
  }

  toOperationNode(): CreateTypeNode {
    return this.#props.node
  }

  /**
   * Creates an anum type.
   *
   * ### Examples
   *
   * ```ts
   * db.schema.createType('species').asEnum(['cat', 'dog', 'frog'])
   * ```
   */
  asEnum(values: readonly string[]): CreateTypeBuilder {
    return new CreateTypeBuilder({
      ...this.#props,
      node: CreateTypeNode.cloneWithEnum(this.#props.node, values),
    })
  }

  /**
   * Simply calls the provided function passing `this` as the only argument. `$call` returns
   * what the provided function returns.
   */
  $call<T>(func: (qb: this) => T): T {
    return func(this)
  }

}

export interface CreateTypeBuilderProps {
  readonly node: CreateTypeNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface CreateTypeBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
