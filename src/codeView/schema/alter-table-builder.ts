import { AddColumnNode } from '../../shared/operation-node/add-column-node.js'
import { AlterTableNode } from '../../shared/operation-node/alter-table-node.js'
import { ColumnDefinitionNode } from '../../shared/operation-node/column-definition-node.js'
import { DropColumnNode } from '../../shared/operation-node/drop-column-node.js'
import { IdentifierNode } from '../../shared/operation-node/identifier-node.js'
import type { OperationNodeSource } from '../../shared/operation-node/operation-node-source.js'
import { RenameColumnNode } from '../../shared/operation-node/rename-column-node.js'
import { freeze, isString, noop } from '../../util/object-utils.js'
import {
  ColumnDefinitionBuilder,
  type ColumnDefinitionBuilderCallback,
} from './column-definition-builder.js'
import { ModifyColumnNode } from '../../shared/operation-node/modify-column-node.js'
import {
  type DataTypeExpression,
  parseDataTypeExpression,
} from '../../shared/parser/data-type-parser.js'
import {
  ForeignKeyConstraintBuilder,
  type ForeignKeyConstraintBuilderCallback,
} from './foreign-key-constraint-builder.js'
import { AddConstraintNode } from '../../shared/operation-node/add-constraint-node.js'
import { UniqueConstraintNode } from '../../shared/operation-node/unique-constraint-node.js'
import { CheckConstraintNode } from '../../shared/operation-node/check-constraint-node.js'
import { ForeignKeyConstraintNode } from '../../shared/operation-node/foreign-key-constraint-node.js'
import { ColumnNode } from '../../shared/operation-node/column-node.js'
import { parseTable } from '../../shared/parser/table-parser.js'
import { DropConstraintNode } from '../../shared/operation-node/drop-constraint-node.js'
import type { Expression } from '../expression/expression.js'
import {
  AlterColumnBuilder,
  type AlterColumnBuilderCallback,
} from './alter-column-builder.js'
import { AlterTableExecutor } from './alter-table-executor.js'
import { AlterTableAddForeignKeyConstraintBuilder } from './alter-table-add-foreign-key-constraint-builder.js'
import { AlterTableDropConstraintBuilder } from './alter-table-drop-constraint-builder.js'
import { PrimaryKeyConstraintNode } from '../../shared/operation-node/primary-key-constraint-node.js'
import { DropIndexNode } from '../../shared/operation-node/drop-index-node.js'
import { AddIndexNode } from '../../shared/operation-node/add-index-node.js'
import { AlterTableAddIndexBuilder } from './alter-table-add-index-builder.js'
import {
  UniqueConstraintNodeBuilder,
  type UniqueConstraintNodeBuilderCallback,
} from './unique-constraint-builder.js'
import {
  PrimaryKeyConstraintBuilder,
  type PrimaryKeyConstraintBuilderCallback,
} from './primary-key-constraint-builder.js'
import {
  CheckConstraintBuilder,
  type CheckConstraintBuilderCallback,
} from './check-constraint-builder.js'
import { RenameConstraintNode } from '../../shared/operation-node/rename-constraint-node.js'
import {
  type ExpressionOrFactory,
  parseExpression,
} from '../../shared/parser/expression-parser.js'
import {
  DropColumnBuilder,
  type DropColumnBuilderCallback,
} from './drop-column-builder.js'
import type { Compilable } from '../../util/compilable.js'
import type { AbortableQueryOptions } from '../../types/util/abort.js'

/**
 * This builder can be used to create a `alter table` query.
 */
export class AlterTableBuilder implements ColumnAlteringInterface {
  readonly #props: AlterTableBuilderProps

  constructor(props: AlterTableBuilderProps) {
    this.#props = freeze(props)
  }

  renameTo(newTableName: string): AlterTableExecutor {
    return new AlterTableExecutor({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        renameTo: parseTable(newTableName),
      }),
    })
  }

  setSchema(newSchema: string): AlterTableExecutor {
    return new AlterTableExecutor({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        setSchema: IdentifierNode.create(newSchema),
      }),
    })
  }

  alterColumn(
    column: string,
    alteration: AlterColumnBuilderCallback,
  ): AlterTableColumnAlteringBuilder {
    const builder = alteration(new AlterColumnBuilder(column))

    return new AlterTableColumnAlteringBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithColumnAlteration(
        this.#props.node,
        builder.toOperationNode(),
      ),
    })
  }

  dropColumn(
    column: string,
    build: DropColumnBuilderCallback = noop,
  ): AlterTableColumnAlteringBuilder {
    const builder = build(
      new DropColumnBuilder({ node: DropColumnNode.create(column) }),
    )

    return new AlterTableColumnAlteringBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithColumnAlteration(
        this.#props.node,
        builder.toOperationNode(),
      ),
    })
  }

  renameColumn(
    column: string,
    newColumn: string,
  ): AlterTableColumnAlteringBuilder {
    return new AlterTableColumnAlteringBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithColumnAlteration(
        this.#props.node,
        RenameColumnNode.create(column, newColumn),
      ),
    })
  }

  addColumn(
    columnName: string,
    dataType: DataTypeExpression,
    build: ColumnDefinitionBuilderCallback = noop,
  ): AlterTableColumnAlteringBuilder {
    const builder = build(
      new ColumnDefinitionBuilder(
        ColumnDefinitionNode.create(
          columnName,
          parseDataTypeExpression(dataType),
        ),
      ),
    )

    return new AlterTableColumnAlteringBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithColumnAlteration(
        this.#props.node,
        AddColumnNode.create(builder.toOperationNode()),
      ),
    })
  }

  modifyColumn(
    columnName: string,
    dataType: DataTypeExpression,
    build: ColumnDefinitionBuilderCallback = noop,
  ): AlterTableColumnAlteringBuilder {
    const builder = build(
      new ColumnDefinitionBuilder(
        ColumnDefinitionNode.create(
          columnName,
          parseDataTypeExpression(dataType),
        ),
      ),
    )

    return new AlterTableColumnAlteringBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithColumnAlteration(
        this.#props.node,
        ModifyColumnNode.create(builder.toOperationNode()),
      ),
    })
  }

  /**
   * See {@link CreateTableBuilder.addUniqueConstraint}
   */
  addUniqueConstraint(
    constraintName: string,
    columns: (string | ExpressionOrFactory<any, any, any>)[],
    build: UniqueConstraintNodeBuilderCallback = noop,
  ): AlterTableExecutor {
    const uniqueConstraintBuilder = build(
      new UniqueConstraintNodeBuilder(
        UniqueConstraintNode.create(
          columns.map((column) =>
            isString(column)
              ? ColumnNode.create(column)
              : parseExpression(column),
          ),
          constraintName,
        ),
      ),
    )

    return new AlterTableExecutor({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        addConstraint: AddConstraintNode.create(
          uniqueConstraintBuilder.toOperationNode(),
        ),
      }),
    })
  }

  /**
   * See {@link CreateTableBuilder.addCheckConstraint}
   */
  addCheckConstraint(
    constraintName: string,
    checkExpression: Expression<any>,
    build: CheckConstraintBuilderCallback = noop,
  ): AlterTableExecutor {
    const constraintBuilder = build(
      new CheckConstraintBuilder(
        CheckConstraintNode.create(
          checkExpression.toOperationNode(),
          constraintName,
        ),
      ),
    )

    return new AlterTableExecutor({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        addConstraint: AddConstraintNode.create(
          constraintBuilder.toOperationNode(),
        ),
      }),
    })
  }

  /**
   * See {@link CreateTableBuilder.addForeignKeyConstraint}
   *
   * Unlike {@link CreateTableBuilder.addForeignKeyConstraint} this method returns
   * the constraint builder and doesn't take a callback as the last argument. This
   * is because you can only add one column per `ALTER TABLE` query.
   */
  addForeignKeyConstraint(
    constraintName: string,
    columns: string[],
    targetTable: string,
    targetColumns: string[],
    build: ForeignKeyConstraintBuilderCallback = noop,
  ): AlterTableAddForeignKeyConstraintBuilder {
    const constraintBuilder = build(
      new ForeignKeyConstraintBuilder(
        ForeignKeyConstraintNode.create(
          columns.map(ColumnNode.create),
          parseTable(targetTable),
          targetColumns.map(ColumnNode.create),
          constraintName,
        ),
      ),
    )

    return new AlterTableAddForeignKeyConstraintBuilder({
      ...this.#props,
      constraintBuilder,
    })
  }

  /**
   * See {@link CreateTableBuilder.addPrimaryKeyConstraint}
   */
  addPrimaryKeyConstraint(
    constraintName: string,
    columns: string[],
    build: PrimaryKeyConstraintBuilderCallback = noop,
  ): AlterTableExecutor {
    const constraintBuilder = build(
      new PrimaryKeyConstraintBuilder(
        PrimaryKeyConstraintNode.create(columns, constraintName),
      ),
    )

    return new AlterTableExecutor({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        addConstraint: AddConstraintNode.create(
          constraintBuilder.toOperationNode(),
        ),
      }),
    })
  }

  dropConstraint(constraintName: string): AlterTableDropConstraintBuilder {
    return new AlterTableDropConstraintBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        dropConstraint: DropConstraintNode.create(constraintName),
      }),
    })
  }

  renameConstraint(
    oldName: string,
    newName: string,
  ): AlterTableDropConstraintBuilder {
    return new AlterTableDropConstraintBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        renameConstraint: RenameConstraintNode.create(oldName, newName),
      }),
    })
  }

  /**
   * This can be used to add index to table.
   *
   *  ### Examples
   *
   * ```ts
   * db.schema.alterTable('person')
   *   .addIndex('person_email_index')
   *   .column('email')
   *   .unique()
   *   .execute()
   * ```
   *
   * The generated SQL (MySQL):
   *
   * ```sql
   * alter table `person` add unique index `person_email_index` (`email`)
   * ```
   */
  addIndex(indexName: string): AlterTableAddIndexBuilder {
    return new AlterTableAddIndexBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        addIndex: AddIndexNode.create(indexName),
      }),
    })
  }

  /**
   * This can be used to drop index from table.
   *
   * ### Examples
   *
   * ```ts
   * db.schema.alterTable('person')
   *   .dropIndex('person_email_index')
   *   .execute()
   * ```
   *
   * The generated SQL (MySQL):
   *
   * ```sql
   * alter table `person` drop index `test_first_name_index`
   * ```
   */
  dropIndex(indexName: string): AlterTableExecutor {
    return new AlterTableExecutor({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        dropIndex: DropIndexNode.create(indexName),
      }),
    })
  }

  /**
   * Calls the given function passing `this` as the only argument.
   *
   * See {@link CreateTableBuilder.$call}
   */
  $call<T>(func: (qb: this) => T): T {
    return func(this)
  }
}

export interface AlterTableBuilderProps {
  readonly node: AlterTableNode
}

export interface ColumnAlteringInterface {
  alterColumn(
    column: string,
    alteration: AlterColumnBuilderCallback,
  ): ColumnAlteringInterface

  dropColumn(column: string): ColumnAlteringInterface

  renameColumn(column: string, newColumn: string): ColumnAlteringInterface

  /**
   * See {@link CreateTableBuilder.addColumn}
   */
  addColumn(
    columnName: string,
    dataType: DataTypeExpression,
    build?: ColumnDefinitionBuilderCallback,
  ): ColumnAlteringInterface

  /**
   * Creates an `alter table modify column` query. The `modify column` statement
   * is only implemeted by MySQL and oracle AFAIK. On other databases you
   * should use the `alterColumn` method.
   */
  modifyColumn(
    columnName: string,
    dataType: DataTypeExpression,
    build: ColumnDefinitionBuilderCallback,
  ): ColumnAlteringInterface
}

export class AlterTableColumnAlteringBuilder
  implements ColumnAlteringInterface, OperationNodeSource
{
  readonly #props: AlterTableColumnAlteringBuilderProps

  constructor(props: AlterTableColumnAlteringBuilderProps) {
    this.#props = freeze(props)
  }

  alterColumn(
    column: string,
    alteration: AlterColumnBuilderCallback,
  ): AlterTableColumnAlteringBuilder {
    const builder = alteration(new AlterColumnBuilder(column))

    return new AlterTableColumnAlteringBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithColumnAlteration(
        this.#props.node,
        builder.toOperationNode(),
      ),
    })
  }

  dropColumn(
    column: string,
    build: DropColumnBuilderCallback = noop,
  ): AlterTableColumnAlteringBuilder {
    const builder = build(
      new DropColumnBuilder({ node: DropColumnNode.create(column) }),
    )

    return new AlterTableColumnAlteringBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithColumnAlteration(
        this.#props.node,
        builder.toOperationNode(),
      ),
    })
  }

  renameColumn(
    column: string,
    newColumn: string,
  ): AlterTableColumnAlteringBuilder {
    return new AlterTableColumnAlteringBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithColumnAlteration(
        this.#props.node,
        RenameColumnNode.create(column, newColumn),
      ),
    })
  }

  addColumn(
    columnName: string,
    dataType: DataTypeExpression,
    build: ColumnDefinitionBuilderCallback = noop,
  ): AlterTableColumnAlteringBuilder {
    const builder = build(
      new ColumnDefinitionBuilder(
        ColumnDefinitionNode.create(
          columnName,
          parseDataTypeExpression(dataType),
        ),
      ),
    )

    return new AlterTableColumnAlteringBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithColumnAlteration(
        this.#props.node,
        AddColumnNode.create(builder.toOperationNode()),
      ),
    })
  }

  modifyColumn(
    columnName: string,
    dataType: DataTypeExpression,
    build: ColumnDefinitionBuilderCallback = noop,
  ): AlterTableColumnAlteringBuilder {
    const builder = build(
      new ColumnDefinitionBuilder(
        ColumnDefinitionNode.create(
          columnName,
          parseDataTypeExpression(dataType),
        ),
      ),
    )

    return new AlterTableColumnAlteringBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithColumnAlteration(
        this.#props.node,
        ModifyColumnNode.create(builder.toOperationNode()),
      ),
    })
  }

  toOperationNode(): AlterTableNode {
    return this.#props.node
  }
}

export interface AlterTableColumnAlteringBuilderProps extends AlterTableBuilderProps {}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface AlterTableColumnAlteringBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
