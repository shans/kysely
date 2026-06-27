// CodeView: wraps QueryCreatorProps (plain operation-node data) and exposes a
// structural query-building API (selectFrom, insertInto, etc.). Produces plain
// operation-node trees, holds no mutable state, accepts no callbacks, and does
// not close over any component's context — so it cannot leak data between callers.
// QueryCreatorProps would belong in types/ under the compile-time-erasure rule,
// but it references WithNode which has not yet been moved to types/ (pending
// TODO #16); deferred until that migration is complete.
import {
  type SelectQueryBuilder,
  createSelectQueryBuilder,
} from '../query-builder/select-query-builder.js'
import { InsertQueryBuilder } from '../query-builder/insert-query-builder.js'
import { DeleteQueryBuilder } from '../query-builder/delete-query-builder.js'
import { UpdateQueryBuilder } from '../query-builder/update-query-builder.js'
import { DeleteQueryNode } from '../shared/operation-node/delete-query-node.js'
import { InsertQueryNode } from '../shared/operation-node/insert-query-node.js'
import { SelectQueryNode } from '../shared/operation-node/select-query-node.js'
import { UpdateQueryNode } from '../shared/operation-node/update-query-node.js'
import {
  parseTable,
  parseTableExpressionOrList,
  type TableExpressionOrList,
  type SimpleTableReference,
  parseAliasedTable,
} from '../shared/parser/table-parser.js'
import {
  type CommonTableExpression,
  type QueryCreatorWithCommonTableExpression,
  type RecursiveCommonTableExpression,
  parseCommonTableExpression,
} from '../shared/parser/with-parser.js'
import { WithNode } from '../shared/operation-node/with-node.js'
import { freeze } from '../util/object-utils.js'
import type { InsertResult } from '../query-builder/insert-result.js'
import type { DeleteResult } from '../query-builder/delete-result.js'
import type { UpdateResult } from '../query-builder/update-result.js'
import type { CTEBuilderCallback } from '../query-builder/cte-builder.js'
import {
  type CallbackSelection,
  type SelectArg,
  type SelectCallback,
  type SelectExpression,
  type Selection,
  parseSelectArg,
} from '../shared/parser/select-parser.js'
import { MergeQueryBuilder } from '../query-builder/merge-query-builder.js'
import { MergeQueryNode } from '../shared/operation-node/merge-query-node.js'
import type { MergeResult } from '../query-builder/merge-result.js'
import type { SelectFrom } from '../shared/parser/select-from-parser.js'
import type { DeleteFrom } from '../shared/parser/delete-from-parser.js'
import type { UpdateTable } from '../shared/parser/update-parser.js'
import type { MergeInto } from '../shared/parser/merge-into-parser.js'

export class QueryCreator<DB> {
  readonly #props: QueryCreatorProps

  constructor(props: QueryCreatorProps) {
    this.#props = freeze(props)
  }

  selectFrom<TE extends TableExpressionOrList<DB, never>>(
    from: TE,
  ): SelectFrom<DB, never, TE> {
    return createSelectQueryBuilder({
      queryNode: SelectQueryNode.createFrom(
        parseTableExpressionOrList(from as TableExpressionOrList<any, any>),
        this.#props.withNode,
      ),
    }) as SelectFrom<DB, never, TE>
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
    return createSelectQueryBuilder({
      queryNode: SelectQueryNode.cloneWithSelections(
        SelectQueryNode.create(this.#props.withNode),
        parseSelectArg(selection as any),
      ),
    })
  }

  insertInto<T extends keyof DB & string>(
    table: T,
  ): InsertQueryBuilder<DB, T, InsertResult> {
    return new InsertQueryBuilder({
      queryNode: InsertQueryNode.create(
        parseTable(table),
        this.#props.withNode,
      ),
    })
  }

  replaceInto<T extends keyof DB & string>(
    table: T,
  ): InsertQueryBuilder<DB, T, InsertResult> {
    return new InsertQueryBuilder({
      queryNode: InsertQueryNode.create(
        parseTable(table),
        this.#props.withNode,
        true,
      ),
    })
  }

  deleteFrom<TE extends TableExpressionOrList<DB, never>>(
    from: TE,
  ): DeleteFrom<DB, TE> {
    return new DeleteQueryBuilder({
      queryNode: DeleteQueryNode.create(
        parseTableExpressionOrList(from as TableExpressionOrList<any, any>),
        this.#props.withNode,
      ),
    }) as DeleteFrom<DB, TE>
  }

  updateTable<TE extends TableExpressionOrList<DB, never>>(
    tables: TE,
  ): UpdateTable<DB, TE> {
    return new UpdateQueryBuilder({
      queryNode: UpdateQueryNode.create(
        parseTableExpressionOrList(tables as TableExpressionOrList<any, any>),
        this.#props.withNode,
      ),
    }) as UpdateTable<DB, TE>
  }

  mergeInto<TR extends SimpleTableReference<DB>>(
    targetTable: TR,
  ): MergeInto<DB, TR> {
    return new MergeQueryBuilder({
      queryNode: MergeQueryNode.create(
        parseAliasedTable(targetTable),
        this.#props.withNode,
      ),
    }) as MergeInto<DB, TR>
  }

  with<N extends string, E extends CommonTableExpression<DB, N>>(
    nameOrBuilder: N | CTEBuilderCallback<N>,
    expression: E,
  ): QueryCreatorWithCommonTableExpression<DB, N, E> {
    const cte = parseCommonTableExpression(nameOrBuilder, expression as any)

    return new QueryCreator({
      ...this.#props,
      withNode: this.#props.withNode
        ? WithNode.cloneWithExpression(this.#props.withNode, cte)
        : WithNode.create(cte),
    })
  }

  withRecursive<
    N extends string,
    E extends RecursiveCommonTableExpression<DB, N>,
  >(
    nameOrBuilder: N | CTEBuilderCallback<N>,
    expression: E,
  ): QueryCreatorWithCommonTableExpression<DB, N, E> {
    const cte = parseCommonTableExpression(nameOrBuilder, expression)

    return new QueryCreator({
      ...this.#props,
      withNode: this.#props.withNode
        ? WithNode.cloneWithExpression(this.#props.withNode, cte)
        : WithNode.create(cte, { recursive: true }),
    })
  }
}

export interface QueryCreatorProps {
  readonly withNode?: WithNode
}
