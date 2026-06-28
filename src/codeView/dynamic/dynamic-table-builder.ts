import { AliasNode } from '../../shared/operation-node/alias-node.js'
import { IdentifierNode } from '../../shared/operation-node/identifier-node.js'
import {
  isOperationNodeSource,
  type OperationNodeSource,
} from '../../shared/operation-node/operation-node-source.js'
import { parseTable } from '../../shared/parser/table-parser.js'
import { isObject, isString } from '../../shared/util/object-utils.js'

export class DynamicTableBuilder<T extends string> {
  readonly #table: T

  get table(): T {
    return this.#table
  }

  constructor(table: T) {
    this.#table = table
  }

  as<A extends string>(alias: A): AliasedDynamicTableBuilder<T, A> {
    return new AliasedDynamicTableBuilder(this.#table, alias)
  }
}

export class AliasedDynamicTableBuilder<
  T extends string,
  A extends string,
> implements OperationNodeSource {
  readonly #table: T
  readonly #alias: A

  get table(): T {
    return this.#table
  }

  get alias(): A {
    return this.#alias
  }

  constructor(table: T, alias: A) {
    this.#table = table
    this.#alias = alias
  }

  toOperationNode(): AliasNode {
    return AliasNode.create(
      parseTable(this.#table),
      IdentifierNode.create(this.#alias),
    )
  }
}

export function isAliasedDynamicTableBuilder(
  obj: unknown,
): obj is AliasedDynamicTableBuilder<any, any> {
  return (
    isObject(obj) &&
    isOperationNodeSource(obj) &&
    isString(obj.table) &&
    isString(obj.alias)
  )
}
