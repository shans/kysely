import { ExpressionWrapper } from '../expression/expression-wrapper.js'
import type { Expression } from '../expression/expression.js'
import { AliasNode } from '../shared/operation-node/alias-node.js'
import { ColumnNode } from '../shared/operation-node/column-node.js'
import { IdentifierNode } from '../shared/operation-node/identifier-node.js'
import { ReferenceNode } from '../shared/operation-node/reference-node.js'
import type { SelectQueryNode } from '../shared/operation-node/select-query-node.js'
import { TableNode } from '../shared/operation-node/table-node.js'
import { ValueNode } from '../shared/operation-node/value-node.js'

export function getJsonObjectArgs(
  node: SelectQueryNode,
  table: string,
): Expression<unknown>[] {
  const args: Expression<unknown>[] = []

  for (const { selection: s } of node.selections ?? []) {
    if (ReferenceNode.is(s) && ColumnNode.is(s.column)) {
      args.push(
        colName(s.column.column.name),
        colRef(table, s.column.column.name),
      )
    } else if (ColumnNode.is(s)) {
      args.push(colName(s.column.name), colRef(table, s.column.name))
    } else if (AliasNode.is(s) && IdentifierNode.is(s.alias)) {
      args.push(colName(s.alias.name), colRef(table, s.alias.name))
    } else {
      throw new Error(`can't extract column names from the select query node`)
    }
  }

  return args
}

function colName(col: string): Expression<unknown> {
  return new ExpressionWrapper(ValueNode.createImmediate(col))
}

function colRef(table: string, col: string): Expression<unknown> {
  return new ExpressionWrapper(
    ReferenceNode.create(ColumnNode.create(col), TableNode.create(table)),
  )
}
