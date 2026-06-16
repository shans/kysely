import { AddConstraintNode } from '../operation-node/add-constraint-node.js'
import { AlterTableNode } from '../operation-node/alter-table-node.js'
import type { OperationNodeSource } from '../operation-node/operation-node-source.js'
import type { OnModifyForeignAction } from '../operation-node/references-node.js'
import { freeze } from '../util/object-utils.js'
import type {
  ForeignKeyConstraintBuilder,
  ForeignKeyConstraintBuilderInterface,
} from './foreign-key-constraint-builder.js'
import type { Compilable } from '../util/compilable.js'
import type { AbortableQueryOptions } from '../util/abort.js'

export class AlterTableAddForeignKeyConstraintBuilder
  implements
    ForeignKeyConstraintBuilderInterface<AlterTableAddForeignKeyConstraintBuilder>,
    OperationNodeSource
{
  readonly #props: AlterTableAddForeignKeyConstraintBuilderProps

  constructor(props: AlterTableAddForeignKeyConstraintBuilderProps) {
    this.#props = freeze(props)
  }

  onDelete(
    onDelete: OnModifyForeignAction,
  ): AlterTableAddForeignKeyConstraintBuilder {
    return new AlterTableAddForeignKeyConstraintBuilder({
      ...this.#props,
      constraintBuilder: this.#props.constraintBuilder.onDelete(onDelete),
    })
  }

  onUpdate(
    onUpdate: OnModifyForeignAction,
  ): AlterTableAddForeignKeyConstraintBuilder {
    return new AlterTableAddForeignKeyConstraintBuilder({
      ...this.#props,
      constraintBuilder: this.#props.constraintBuilder.onUpdate(onUpdate),
    })
  }

  deferrable(): AlterTableAddForeignKeyConstraintBuilder {
    return new AlterTableAddForeignKeyConstraintBuilder({
      ...this.#props,
      constraintBuilder: this.#props.constraintBuilder.deferrable(),
    })
  }

  notDeferrable(): AlterTableAddForeignKeyConstraintBuilder {
    return new AlterTableAddForeignKeyConstraintBuilder({
      ...this.#props,
      constraintBuilder: this.#props.constraintBuilder.notDeferrable(),
    })
  }

  initiallyDeferred(): AlterTableAddForeignKeyConstraintBuilder {
    return new AlterTableAddForeignKeyConstraintBuilder({
      ...this.#props,
      constraintBuilder: this.#props.constraintBuilder.initiallyDeferred(),
    })
  }

  initiallyImmediate(): AlterTableAddForeignKeyConstraintBuilder {
    return new AlterTableAddForeignKeyConstraintBuilder({
      ...this.#props,
      constraintBuilder: this.#props.constraintBuilder.initiallyImmediate(),
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
    return AlterTableNode.cloneWithTableProps(this.#props.node, {
      addConstraint: AddConstraintNode.create(
        this.#props.constraintBuilder.toOperationNode(),
      ),
    })
  }
}

export interface AlterTableAddForeignKeyConstraintBuilderProps {
  readonly node: AlterTableNode
  readonly constraintBuilder: ForeignKeyConstraintBuilder
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface AlterTableAddForeignKeyConstraintBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
