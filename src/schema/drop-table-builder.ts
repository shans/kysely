import { DropTableNode } from '../operation-node/drop-table-node.js'
import type { OperationNodeSource } from '../operation-node/operation-node-source.js'
import { freeze } from '../util/object-utils.js'
import type { Compilable } from '../util/compilable.js'
import type { AbortableQueryOptions } from '../util/abort.js'

export class DropTableBuilder implements OperationNodeSource {
  readonly #props: DropTableBuilderProps

  constructor(props: DropTableBuilderProps) {
    this.#props = freeze(props)
  }

  /**
   * Adds the "temporary" modifier.
   *
   * This is only supported by some dialects like MySQL.
   */
  temporary(): DropTableBuilder {
    return new DropTableBuilder({
      ...this.#props,
      node: DropTableNode.cloneWith(this.#props.node, {
        temporary: true,
      }),
    })
  }

  ifExists(): DropTableBuilder {
    return new DropTableBuilder({
      ...this.#props,
      node: DropTableNode.cloneWith(this.#props.node, {
        ifExists: true,
      }),
    })
  }

  cascade(): DropTableBuilder {
    return new DropTableBuilder({
      ...this.#props,
      node: DropTableNode.cloneWith(this.#props.node, {
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

  toOperationNode(): DropTableNode {
    return this.#props.node
  }
}

export interface DropTableBuilderProps {
  readonly node: DropTableNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface DropTableBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
