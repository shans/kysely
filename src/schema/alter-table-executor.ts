import type { AlterTableNode } from '../operation-node/alter-table-node.js'
import type { OperationNodeSource } from '../operation-node/operation-node-source.js'
import { freeze } from '../util/object-utils.js'
import type { Compilable } from '../util/compilable.js'
import type { AbortableQueryOptions } from '../shared/util/abort.js'

export class AlterTableExecutor implements OperationNodeSource {
  readonly #props: AlterTableExecutorProps

  constructor(props: AlterTableExecutorProps) {
    this.#props = freeze(props)
  }

  toOperationNode(): AlterTableNode {
    return this.#props.node
  }
}

export interface AlterTableExecutorProps {
  readonly node: AlterTableNode
}

// Declaration merge: adds terminal method types without runtime stubs.
// The API-layer Proxy provides the implementations at runtime.
export interface AlterTableExecutor extends Compilable {
  execute(options?: AbortableQueryOptions): Promise<void>
}
