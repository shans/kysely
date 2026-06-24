import { QueryCreator, type QueryCreatorProps } from './shared/query-creator.js'
import { WithNode } from './operation-node/with-node.js'
import { parseCommonTableExpression } from './parser/with-parser.js'
import { SchemaModule } from './schema/schema-module.js'
import { DynamicModule } from './dynamic/dynamic.js'
import { createFunctionModule } from './query-builder/function-module.js'
import { freeze } from './util/object-utils.js'
import type { FunctionModule } from './query-builder/function-module.js'
import type { SelectFrom } from './parser/select-from-parser.js'
import type { DeleteFrom } from './parser/delete-from-parser.js'
import type { UpdateTable } from './parser/update-parser.js'
import type { MergeInto } from './parser/merge-into-parser.js'
import type { TableExpressionOrList, SimpleTableReference } from './parser/table-parser.js'
import type { InsertResult } from './query-builder/insert-result.js'
import type { InsertQueryBuilder } from './query-builder/insert-query-builder.js'
import type { SelectQueryBuilder } from './query-builder/select-query-builder.js'
import type {
  CallbackSelection,
  SelectArg,
  SelectCallback,
  SelectExpression,
  Selection,
} from './parser/select-parser.js'

export class KyselyBuilder<DB> {
  readonly #props: QueryCreatorProps
  readonly #creator: QueryCreator<DB>

  constructor(props: QueryCreatorProps = {}) {
    this.#props = freeze(props)
    this.#creator = new QueryCreator<DB>(this.#props)
  }

  selectFrom<TE extends TableExpressionOrList<DB, never>>(from: TE): SelectFrom<DB, never, TE> {
    return this.#creator.selectFrom(from)
  }

  selectNoFrom<SE extends SelectExpression<DB, never>>(
    selections: ReadonlyArray<SE>,
  ): SelectQueryBuilder<DB, never, Selection<DB, never, SE>>

  selectNoFrom<const CB extends SelectCallback<DB, never>>(
    callback: CB,
  ): SelectQueryBuilder<DB, never, CallbackSelection<DB, never, CB>>

  selectNoFrom<SE extends SelectExpression<DB, never>>(
    selection: SE,
  ): SelectQueryBuilder<DB, never, Selection<DB, never, SE>>

  selectNoFrom<SE extends SelectExpression<DB, never>>(
    selection: SelectArg<DB, never, SE>,
  ): SelectQueryBuilder<DB, never, Selection<DB, never, SE>> {
    return this.#creator.selectNoFrom(selection as any) as any
  }

  insertInto<T extends keyof DB & string>(table: T): InsertQueryBuilder<DB, T, InsertResult> {
    return this.#creator.insertInto(table)
  }

  replaceInto<T extends keyof DB & string>(table: T): InsertQueryBuilder<DB, T, InsertResult> {
    return this.#creator.replaceInto(table)
  }

  deleteFrom<TE extends TableExpressionOrList<DB, never>>(from: TE): DeleteFrom<DB, TE> {
    return this.#creator.deleteFrom(from)
  }

  updateTable<TE extends TableExpressionOrList<DB, never>>(tables: TE): UpdateTable<DB, TE> {
    return this.#creator.updateTable(tables)
  }

  mergeInto<TR extends SimpleTableReference<DB>>(targetTable: TR): MergeInto<DB, TR> {
    return this.#creator.mergeInto(targetTable)
  }

  with(nameOrBuilder: any, expression: any): KyselyBuilder<any> {
    const cte = parseCommonTableExpression(nameOrBuilder, expression)
    return new KyselyBuilder<any>({
      withNode: this.#props.withNode
        ? WithNode.cloneWithExpression(this.#props.withNode, cte)
        : WithNode.create(cte),
    })
  }

  withRecursive(nameOrBuilder: any, expression: any): KyselyBuilder<any> {
    const cte = parseCommonTableExpression(nameOrBuilder, expression)
    return new KyselyBuilder<any>({
      withNode: this.#props.withNode
        ? WithNode.cloneWithExpression(this.#props.withNode, cte)
        : WithNode.create(cte, { recursive: true }),
    })
  }

  get schema(): SchemaModule {
    return new SchemaModule()
  }

  get fn(): FunctionModule<DB, keyof DB> {
    return createFunctionModule()
  }

  get dynamic(): DynamicModule<DB> {
    return new DynamicModule<DB>()
  }
}
