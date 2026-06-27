import { AlterTableNode } from '../../shared/operation-node/alter-table-node.js'
import { DropConstraintNode } from '../../shared/operation-node/drop-constraint-node.js'
import type { OperationNodeSource } from '../../shared/operation-node/operation-node-source.js'
import { freeze } from '../../util/object-utils.js'
import type { Compilable } from '../../util/compilable.js'
import type { AbortableQueryOptions } from '../../types/util/abort.js'

export class AlterTableDropConstraintBuilder
  implements OperationNodeSource
{
  readonly #props: AlterTableDropConstraintBuilderProps

  constructor(props: AlterTableDropConstraintBuilderProps) {
    this.#props = freeze(props)
  }

  ifExists(): AlterTableDropConstraintBuilder {
    return new AlterTableDropConstraintBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        dropConstraint: DropConstraintNode.cloneWith(
          this.#props.node.dropConstraint!,
          {
            ifExists: true,
          },
        ),
      }),
    })
  }

  cascade(): AlterTableDropConstraintBuilder {
    return new AlterTableDropConstraintBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        dropConstraint: DropConstraintNode.cloneWith(
          this.#props.node.dropConstraint!,
          {
            modifier: 'cascade',
          },
        ),
      }),
    })
  }

  restrict(): AlterTableDropConstraintBuilder {
    return new AlterTableDropConstraintBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        dropConstraint: DropConstraintNode.cloneWith(
          this.#props.node.dropConstraint!,
          {
            modifier: 'restrict',
          },
        ),
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

  toOperationNode(): AlterTableNode {
    return this.#props.node
  }
}

export interface AlterTableDropConstraintBuilderProps {
  readonly node: AlterTableNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface AlterTableDropConstraintBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
