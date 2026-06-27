import { CreateSchemaNode } from '../../shared/operation-node/create-schema-node.js'
import type { OperationNodeSource } from '../../shared/operation-node/operation-node-source.js'
import { freeze } from '../../util/object-utils.js'
import type { Compilable } from '../../util/compilable.js'
import type { AbortableQueryOptions } from '../../types/util/abort.js'

export class CreateSchemaBuilder implements OperationNodeSource {
  readonly #props: CreateSchemaBuilderProps

  constructor(props: CreateSchemaBuilderProps) {
    this.#props = freeze(props)
  }

  ifNotExists(): CreateSchemaBuilder {
    return new CreateSchemaBuilder({
      ...this.#props,
      node: CreateSchemaNode.cloneWith(this.#props.node, { ifNotExists: true }),
    })
  }

  /**
   * Simply calls the provided function passing `this` as the only argument. `$call` returns
   * what the provided function returns.
   */
  $call<T>(func: (qb: this) => T): T {
    return func(this)
  }

  toOperationNode(): CreateSchemaNode {
    return this.#props.node
  }
}

export interface CreateSchemaBuilderProps {
  readonly node: CreateSchemaNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface CreateSchemaBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
