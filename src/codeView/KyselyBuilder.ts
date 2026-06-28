// CodeView: wraps QueryCreator and restricts its API to structural methods only,
// excluding plugin and schema-mutation methods. Used by api.ts to accumulate
// query-node state (selectFrom, with, etc.) without exposing the full
// QueryCreator surface. Holds no mutable state; each mutating method returns
// a new instance.
import { QueryCreator, type QueryCreatorProps } from './QueryCreator.js'
import { WithNode } from '../shared/operation-node/with-node.js'
import { parseCommonTableExpression } from '../shared/parser/with-parser.js'
import { SchemaModule } from './schema/schema-module.js'
import { DynamicModule } from './dynamic/dynamic.js'
import { createFunctionModule } from '../codeView/query-builder/function-module.js'
import { freeze } from '../shared/util/object-utils.js'
import type { FunctionModule } from '../codeView/query-builder/function-module.js'
import type { SelectFrom } from '../shared/parser/select-from-parser.js'
import type { DeleteFrom } from '../shared/parser/delete-from-parser.js'
import type { UpdateTable } from '../shared/parser/update-parser.js'
import type { MergeInto } from '../shared/parser/merge-into-parser.js'
import type { TableExpressionOrList, SimpleTableReference } from '../shared/parser/table-parser.js'
import type { InsertResult } from '../codeView/query-builder/insert-result.js'
import type { InsertQueryBuilder } from '../codeView/query-builder/insert-query-builder.js'
import type { SelectQueryBuilder } from '../codeView/query-builder/select-query-builder.js'
import type {
  CallbackSelection,
  SelectArg,
  SelectCallback,
  SelectExpression,
  Selection,
} from '../shared/parser/select-parser.js'

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
