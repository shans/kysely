import type { Expression } from '../../codeView/expression/expression.js'
import { isOperationNodeSource } from '../../shared/operation-node/operation-node-source.js'
import type { OperationNode } from '../../shared/operation-node/operation-node.js'
import { ValueNode } from '../../shared/operation-node/value-node.js'

export type DefaultValueExpression = unknown | Expression<unknown>

export function parseDefaultValueExpression(
  value: DefaultValueExpression,
): OperationNode {
  return isOperationNodeSource(value)
    ? value.toOperationNode()
    : ValueNode.createImmediate(value)
}
