import type { Expression } from '../../codeView/expression/expression.js'
import {
  type ColumnDataType,
  DataTypeNode,
  isColumnDataType,
} from '../../shared/operation-node/data-type-node.js'
import { isOperationNodeSource } from '../../shared/operation-node/operation-node-source.js'
import type { OperationNode } from '../../shared/operation-node/operation-node.js'

export type DataTypeExpression = ColumnDataType | Expression<any>

export function parseDataTypeExpression(
  dataType: DataTypeExpression,
): OperationNode {
  if (isOperationNodeSource(dataType)) {
    return dataType.toOperationNode()
  }

  if (isColumnDataType(dataType)) {
    return DataTypeNode.create(dataType)
  }

  throw new Error(`invalid column data type ${JSON.stringify(dataType)}`)
}
