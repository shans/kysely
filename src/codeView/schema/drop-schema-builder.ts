import { DropSchemaNode } from '../../shared/operation-node/drop-schema-node.js'
import type { OperationNodeSource } from '../../shared/operation-node/operation-node-source.js'
import { freeze } from '../../shared/util/object-utils.js'
import type { Compilable } from '../../shared/util/compilable.js'
import type { AbortableQueryOptions } from '../../types/util/abort.js'

export class DropSchemaBuilder implements OperationNodeSource {
  readonly #props: DropSchemaBuilderProps

  constructor(props: DropSchemaBuilderProps) {
    this.#props = freeze(props)
  }

  ifExists(): DropSchemaBuilder {
    return new DropSchemaBuilder({
      ...this.#props,
      node: DropSchemaNode.cloneWith(this.#props.node, {
        ifExists: true,
      }),
    })
  }

  cascade(): DropSchemaBuilder {
    return new DropSchemaBuilder({
      ...this.#props,
      node: DropSchemaNode.cloneWith(this.#props.node, {
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

  toOperationNode(): DropSchemaNode {
    return this.#props.node
  }
}

export interface DropSchemaBuilderProps {
  readonly node: DropSchemaNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface DropSchemaBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
