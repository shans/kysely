import type { RootOperationNode as RootOperationNodeRaw } from '../operation-node/root-operation-node.js'

export type { RootOperationNodeRaw }

// CodeView over RootOperationNodeRaw (tactic 06).
// Wrap any Kysely builder with .from(), then call .build() to extract the plain
// data for sending on a channel. The "builder methods" are those on the underlying
// Kysely builder — use a DummyDriver-backed Kysely instance to build without an executor.
export class RootOperationNode {
  private constructor(private readonly node: RootOperationNodeRaw) {}

  static from(
    builder: { toOperationNode(): RootOperationNodeRaw },
  ): RootOperationNode {
    return new RootOperationNode(builder.toOperationNode())
  }

  build(): RootOperationNodeRaw {
    return this.node
  }
}
