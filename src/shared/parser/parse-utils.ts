import { JoinNode, type JoinType } from '../../shared/operation-node/join-node.js'
import { OverNode } from '../../shared/operation-node/over-node.js'
import { SelectQueryNode } from '../../shared/operation-node/select-query-node.js'
import { JoinBuilder } from '../../codeView/query-builder/join-builder.js'
import { OverBuilder } from '../../codeView/query-builder/over-builder.js'
import {
  type SelectQueryBuilder,
  createSelectQueryBuilder as newSelectQueryBuilder,
} from '../../codeView/query-builder/select-query-builder.js'
import { QueryCreator } from '../../codeView/QueryCreator.js'
import {
  parseTableExpression,
  parseTableExpressionOrList,
  type TableExpression,
} from './table-parser.js'

export function createSelectQueryBuilder(): SelectQueryBuilder<any, any, any> {
  return newSelectQueryBuilder({
    queryNode: SelectQueryNode.createFrom(parseTableExpressionOrList([])),
  })
}

export function createQueryCreator(): QueryCreator<any> {
  return new QueryCreator({})
}

export function createJoinBuilder(
  joinType: JoinType,
  table: TableExpression<any, any>,
): JoinBuilder<any, any> {
  return new JoinBuilder({
    joinNode: JoinNode.create(joinType, parseTableExpression(table)),
  })
}

export function createOverBuilder(): OverBuilder<any, any> {
  return new OverBuilder({
    overNode: OverNode.create(),
  })
}
