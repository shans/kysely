import type { Expression } from '../expression/expression.js'
import { AddIndexNode } from '../shared/operation-node/add-index-node.js'
import { AlterTableNode } from '../shared/operation-node/alter-table-node.js'
import type { IndexType } from '../shared/operation-node/create-index-node.js'
import type { OperationNodeSource } from '../shared/operation-node/operation-node-source.js'
import { RawNode } from '../shared/operation-node/raw-node.js'
import {
  type OrderedColumnName,
  parseOrderedColumnName,
} from '../shared/parser/reference-parser.js'
import { freeze, isString } from '../util/object-utils.js'
import type { Compilable } from '../util/compilable.js'
import type { AbortableQueryOptions } from '../types/util/abort.js'

export class AlterTableAddIndexBuilder
  implements OperationNodeSource
{
  readonly #props: AlterTableAddIndexBuilderProps

  constructor(props: AlterTableAddIndexBuilderProps) {
    this.#props = freeze(props)
  }

  /**
   * Makes the index unique.
   *
   * ### Examples
   *
   * ```ts
   * await db.schema
   *   .alterTable('person')
   *   .addIndex('person_first_name_index')
   *   .unique()
   *   .column('email')
   *   .execute()
   * ```
   *
   * The generated SQL (MySQL):
   *
   * ```sql
   * alter table `person` add unique index `person_first_name_index` (`email`)
   * ```
   */
  unique(): AlterTableAddIndexBuilder {
    return new AlterTableAddIndexBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        addIndex: AddIndexNode.cloneWith(this.#props.node.addIndex!, {
          unique: true,
        }),
      }),
    })
  }

  /**
   * Adds a column to the index.
   *
   * Also see {@link columns} for adding multiple columns at once or {@link expression}
   * for specifying an arbitrary expression.
   *
   * ### Examples
   *
   * ```ts
   * import { sql } from 'kysely'
   *
   * await db.schema
   *   .alterTable('person')
   *   .addIndex('person_first_name_and_age_index')
   *   .column('first_name')
   *   .column(sql`(left(lower(last_name), 1))`)
   *   .column('age desc')
   *   .execute()
   * ```
   *
   * The generated SQL (MySQL):
   *
   * ```sql
   * alter table `person`
   * add index `person_first_name_and_age_index` (
   *   `first_name`,
   *   (left(lower(last_name), 1)),
   *   `age` desc
   * )
   * ```
   */
  column<CL extends string>(
    column: OrderedColumnName<CL>,
  ): AlterTableAddIndexBuilder

  column(expression: Expression<any>): AlterTableAddIndexBuilder

  column(arg: any): any {
    return new AlterTableAddIndexBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        addIndex: AddIndexNode.cloneWithColumns(this.#props.node.addIndex!, [
          isString(arg) ? parseOrderedColumnName(arg) : arg.toOperationNode(),
        ]),
      }),
    })
  }

  /**
   * Specifies a list of columns for the index.
   *
   * Also see {@link column} for adding a single column or {@link expression} for
   * specifying an arbitrary expression.
   *
   * ### Examples
   *
   * ```ts
   * import { sql } from 'kysely'
   *
   * await db.schema
   *   .alterTable('person')
   *   .addIndex('person_first_name_and_age_index')
   *   .columns(['first_name', sql`(left(lower(last_name), 1))`, 'age desc'])
   *   .execute()
   * ```
   *
   * The generated SQL (MySQL):
   *
   * ```sql
   * alter table `person`
   * add index `person_first_name_and_age_index` (
   *   `first_name`,
   *   (left(lower(last_name), 1)),
   *   `age` desc
   * )
   * ```
   */
  columns<CL extends string>(
    columns: (OrderedColumnName<CL> | Expression<any>)[],
  ): AlterTableAddIndexBuilder {
    return new AlterTableAddIndexBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        addIndex: AddIndexNode.cloneWithColumns(
          this.#props.node.addIndex!,
          columns.map((item) =>
            isString(item)
              ? parseOrderedColumnName(item)
              : item.toOperationNode(),
          ),
        ),
      }),
    })
  }

  /**
   * Specifies an arbitrary expression for the index.
   *
   * ### Examples
   *
   * ```ts
   * import { sql } from 'kysely'
   *
   * await db.schema
   *   .alterTable('person')
   *   .addIndex('person_first_name_index')
   *   .expression(sql<boolean>`(first_name < 'Sami')`)
   *   .execute()
   * ```
   *
   * The generated SQL (MySQL):
   *
   * ```sql
   * alter table `person` add index `person_first_name_index` ((first_name < 'Sami'))
   * ```
   *
   * @deprecated Use {@link column} or {@link columns} with an {@link Expression} instead.
   */
  // TODO: remove in v0.30
  expression(expression: Expression<any>): AlterTableAddIndexBuilder {
    return new AlterTableAddIndexBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        addIndex: AddIndexNode.cloneWithColumns(this.#props.node.addIndex!, [
          expression.toOperationNode(),
        ]),
      }),
    })
  }

  /**
   * Specifies the index type.
   *
   * ### Examples
   *
   * ```ts
   * await db.schema
   *   .alterTable('person')
   *   .addIndex('person_first_name_index')
   *   .column('first_name')
   *   .using('hash')
   *   .execute()
   * ```
   *
   * The generated SQL (MySQL):
   *
   * ```sql
   * alter table `person` add index `person_first_name_index` (`first_name`) using hash
   * ```
   */
  using(indexType: IndexType): AlterTableAddIndexBuilder
  using(indexType: string): AlterTableAddIndexBuilder
  using(indexType: string): AlterTableAddIndexBuilder {
    return new AlterTableAddIndexBuilder({
      ...this.#props,
      node: AlterTableNode.cloneWithTableProps(this.#props.node, {
        addIndex: AddIndexNode.cloneWith(this.#props.node.addIndex!, {
          using: RawNode.createWithSql(indexType),
        }),
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

export interface AlterTableAddIndexBuilderProps {
  readonly node: AlterTableNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface AlterTableAddIndexBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
