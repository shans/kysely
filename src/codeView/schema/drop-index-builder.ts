import { DropIndexNode } from '../../shared/operation-node/drop-index-node.js'
import type { OperationNodeSource } from '../../shared/operation-node/operation-node-source.js'
import { parseTable } from '../../shared/parser/table-parser.js'
import { freeze } from '../../util/object-utils.js'
import type { Compilable } from '../../util/compilable.js'
import type { AbortableQueryOptions } from '../../types/util/abort.js'

export class DropIndexBuilder implements OperationNodeSource {
  readonly #props: DropIndexBuilderProps

  constructor(props: DropIndexBuilderProps) {
    this.#props = freeze(props)
  }

  /**
   * Specifies the table the index was created for. This is not needed
   * in all dialects.
   */
  on(table: string): DropIndexBuilder {
    return new DropIndexBuilder({
      ...this.#props,
      node: DropIndexNode.cloneWith(this.#props.node, {
        table: parseTable(table),
      }),
    })
  }

  ifExists(): DropIndexBuilder {
    return new DropIndexBuilder({
      ...this.#props,
      node: DropIndexNode.cloneWith(this.#props.node, {
        ifExists: true,
      }),
    })
  }

  cascade(): DropIndexBuilder {
    return new DropIndexBuilder({
      ...this.#props,
      node: DropIndexNode.cloneWith(this.#props.node, {
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

  toOperationNode(): DropIndexNode {
    return this.#props.node
  }
}

export interface DropIndexBuilderProps {
  readonly node: DropIndexNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface DropIndexBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
