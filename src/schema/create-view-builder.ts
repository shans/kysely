import type { OperationNodeSource } from '../shared/operation-node/operation-node-source.js'
import { freeze } from '../util/object-utils.js'
import { CreateViewNode } from '../shared/operation-node/create-view-node.js'
import { parseColumnName } from '../shared/parser/reference-parser.js'
import { ImmediateValueTransformer } from '../plugin/immediate-value/immediate-value-transformer.js'
import type { RawBuilder } from '../raw-builder/raw-builder.js'
import type { SelectQueryBuilder } from '../query-builder/select-query-builder.js'
import type { Compilable } from '../util/compilable.js'
import type { AbortableQueryOptions } from '../types/util/abort.js'

export class CreateViewBuilder implements OperationNodeSource {
  readonly #props: CreateViewBuilderProps

  constructor(props: CreateViewBuilderProps) {
    this.#props = freeze(props)
  }

  /**
   * Adds the "temporary" modifier.
   *
   * Use this to create a temporary view.
   */
  temporary(): CreateViewBuilder {
    return new CreateViewBuilder({
      ...this.#props,
      node: CreateViewNode.cloneWith(this.#props.node, {
        temporary: true,
      }),
    })
  }

  materialized(): CreateViewBuilder {
    return new CreateViewBuilder({
      ...this.#props,
      node: CreateViewNode.cloneWith(this.#props.node, {
        materialized: true,
      }),
    })
  }

  /**
   * Only implemented on some dialects like SQLite. On most dialects, use {@link orReplace}.
   */
  ifNotExists(): CreateViewBuilder {
    return new CreateViewBuilder({
      ...this.#props,
      node: CreateViewNode.cloneWith(this.#props.node, {
        ifNotExists: true,
      }),
    })
  }

  orReplace(): CreateViewBuilder {
    return new CreateViewBuilder({
      ...this.#props,
      node: CreateViewNode.cloneWith(this.#props.node, {
        orReplace: true,
      }),
    })
  }

  columns(columns: string[]): CreateViewBuilder {
    return new CreateViewBuilder({
      ...this.#props,
      node: CreateViewNode.cloneWith(this.#props.node, {
        columns: columns.map(parseColumnName),
      }),
    })
  }

  /**
   * Sets the select query or a `values` statement that creates the view.
   *
   * WARNING!
   * Some dialects don't support parameterized queries in DDL statements and therefore
   * the query or raw {@link sql } expression passed here is interpolated into a single
   * string opening an SQL injection vulnerability. DO NOT pass unchecked user input
   * into the query or raw expression passed to this method!
   */
  as(
    query: SelectQueryBuilder<any, any, any> | RawBuilder<any>,
  ): CreateViewBuilder {
    const queryNode = new ImmediateValueTransformer().transformNode(
      query.toOperationNode() as any,
    )

    return new CreateViewBuilder({
      ...this.#props,
      node: CreateViewNode.cloneWith(this.#props.node, {
        as: queryNode,
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

  toOperationNode(): CreateViewNode {
    return this.#props.node
  }
}

export interface CreateViewBuilderProps {
  readonly node: CreateViewNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface CreateViewBuilder extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
