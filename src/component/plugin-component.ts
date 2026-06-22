import type { QueryResult } from '../driver/database-connection.js'
import type { QueryId } from '../util/query-id.js'
import type { UnknownRow } from '../util/type-utils.js'
import type { KyselyPlugin } from '../plugin/kysely-plugin.js'
import type { RootOperationNodeRaw } from './root-operation-node.js'
import type { AbortableOperationOptions } from '../util/abort.js'
import { ChannelIn, ChannelOut, Component, asFunction, asAsyncFunction } from '../channels/channel.js'
import { ComponentHole } from '../channels/component-hole.js'

// Metadata carried through the plugin hole for streaming queries so the
// executor can set up the stream after transform without a shared state map.
export interface StreamMeta {
  readonly streamId: string
  readonly chunkSize: number
  readonly options?: AbortableOperationOptions
}

export interface PluginQueryArgs {
  readonly node: RootOperationNodeRaw
  readonly queryId: QueryId
  readonly streamMeta?: StreamMeta
}

export interface PluginResultArgs {
  readonly result: QueryResult<UnknownRow>
  readonly queryId: QueryId
}

// Output of the transformQuery phase — mirrors PluginQueryArgs with the
// transformed node; streamMeta is carried through unchanged.
export interface TransformedQueryResult {
  readonly node: RootOperationNodeRaw
  readonly queryId: QueryId
  readonly streamMeta?: StreamMeta
}

// Abstract base for all plugin components. Extends Component so ComponentHole
// can use it as its type parameter (C extends Component).
export abstract class KyselyPluginShape extends Component {
  abstract readonly transformQueryIn: ChannelIn<PluginQueryArgs>
  abstract readonly transformQueryOut: ChannelOut<TransformedQueryResult>
  abstract readonly transformResultIn: ChannelIn<PluginResultArgs>
  abstract readonly transformResultOut: ChannelOut<QueryResult<UnknownRow>>
  // Separate path for stream chunk results — same plugin method, distinct channels
  // so stream chunks can be re-wrapped and routed to streamChunkOut, not resultOut.
  abstract readonly transformStreamResultIn: ChannelIn<PluginResultArgs>
  abstract readonly transformStreamResultOut: ChannelOut<QueryResult<UnknownRow>>
  // Async errors from either transformResult path propagate here.
  abstract readonly errorOut: ChannelOut<unknown>
}

// Wraps one KyselyPlugin in the component model.
export class KyselyPluginComponent extends KyselyPluginShape {
  readonly transformQueryIn = new ChannelIn<PluginQueryArgs>(this, this.handleTransformQuery)
  readonly transformQueryOut = new ChannelOut<TransformedQueryResult>()
  readonly transformResultIn = new ChannelIn<PluginResultArgs>(this, this.handleTransformResult)
  readonly transformResultOut = new ChannelOut<QueryResult<UnknownRow>>()
  readonly transformStreamResultIn = new ChannelIn<PluginResultArgs>(this, this.handleTransformStreamResult)
  readonly transformStreamResultOut = new ChannelOut<QueryResult<UnknownRow>>()
  readonly errorOut = new ChannelOut<unknown>()

  constructor(private readonly plugin: KyselyPlugin) { super() }

  // No try/catch: sync throws propagate back through the channel send chain to
  // KyselyEntryComponent's handler which catches and routes to errorOut.
  private handleTransformQuery({ node, queryId, streamMeta }: PluginQueryArgs): void {
    this.transformQueryOut.send({
      node: this.plugin.transformQuery({ node: node as any, queryId }) as RootOperationNodeRaw,
      queryId,
      streamMeta,
    })
  }

  private async handleTransformResult({ result, queryId }: PluginResultArgs): Promise<void> {
    try {
      const transformed = await this.plugin.transformResult({ queryId, result: result as any })
      this.transformResultOut.send(transformed as QueryResult<UnknownRow>)
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  private async handleTransformStreamResult({ result, queryId }: PluginResultArgs): Promise<void> {
    try {
      const transformed = await this.plugin.transformResult({ queryId, result: result as any })
      this.transformStreamResultOut.send(transformed as QueryResult<UnknownRow>)
    } catch (error) {
      this.errorOut.send(error)
    }
  }
}

// Chains N KyselyPluginShape components in series. With 0 plugins acts as a no-op.
// Uses asFunction/asAsyncFunction at construction time so the wiring is static.
export class CompositeKyselyPluginComponent extends KyselyPluginShape {
  readonly transformQueryIn = new ChannelIn<PluginQueryArgs>(this, this.handleTransformQuery)
  readonly transformQueryOut = new ChannelOut<TransformedQueryResult>()
  readonly transformResultIn = new ChannelIn<PluginResultArgs>(this, this.handleTransformResult)
  readonly transformResultOut = new ChannelOut<QueryResult<UnknownRow>>()
  readonly transformStreamResultIn = new ChannelIn<PluginResultArgs>(this, this.handleTransformStreamResult)
  readonly transformStreamResultOut = new ChannelOut<QueryResult<UnknownRow>>()
  readonly errorOut = new ChannelOut<unknown>()

  private readonly queryFns: ReadonlyArray<(args: PluginQueryArgs) => TransformedQueryResult>
  private readonly resultFns: ReadonlyArray<(args: PluginResultArgs) => Promise<QueryResult<UnknownRow>>>
  private readonly streamResultFns: ReadonlyArray<(args: PluginResultArgs) => Promise<QueryResult<UnknownRow>>>

  constructor(plugins: readonly KyselyPluginShape[]) {
    super()
    this.queryFns = plugins.map((p) => asFunction(p.transformQueryIn, p.transformQueryOut))
    // Pass each plugin's errorOut so asAsyncFunction can reject the promise on error.
    this.resultFns = plugins.map((p) => asAsyncFunction(p.transformResultIn, p.transformResultOut, p.errorOut))
    this.streamResultFns = plugins.map((p) => asAsyncFunction(p.transformStreamResultIn, p.transformStreamResultOut, p.errorOut))
  }

  // No try/catch: sync errors from asFunction propagate to the caller.
  private handleTransformQuery({ node, queryId, streamMeta }: PluginQueryArgs): void {
    let currentNode: RootOperationNodeRaw = node
    for (const fn of this.queryFns) {
      currentNode = fn({ node: currentNode, queryId, streamMeta }).node
    }
    this.transformQueryOut.send({ node: currentNode, queryId, streamMeta })
  }

  private async handleTransformResult({ result, queryId }: PluginResultArgs): Promise<void> {
    try {
      let current: QueryResult<UnknownRow> = result
      for (const fn of this.resultFns) {
        current = await fn({ result: current, queryId })
      }
      this.transformResultOut.send(current)
    } catch (error) {
      this.errorOut.send(error)
    }
  }

  private async handleTransformStreamResult({ result, queryId }: PluginResultArgs): Promise<void> {
    try {
      let current: QueryResult<UnknownRow> = result
      for (const fn of this.streamResultFns) {
        current = await fn({ result: current, queryId })
      }
      this.transformStreamResultOut.send(current)
    } catch (error) {
      this.errorOut.send(error)
    }
  }
}

// Returns true for KyselyPluginShape components; false for plain KyselyPlugin objects.
export function isKyselyPluginShape(p: KyselyPlugin | KyselyPluginShape): p is KyselyPluginShape {
  return p instanceof Component
}

// Wraps a KyselyPlugin or KyselyPluginShape as a KyselyPluginShape component.
export function toKyselyPluginShape(p: KyselyPlugin | KyselyPluginShape): KyselyPluginShape {
  return isKyselyPluginShape(p) ? p : new KyselyPluginComponent(p)
}

// Static accessor descriptors used by all plugin holes.
const pluginInputAccessors = {
  transformQuery:        (c: KyselyPluginShape) => c.transformQueryIn,
  transformResult:       (c: KyselyPluginShape) => c.transformResultIn,
  transformStreamResult: (c: KyselyPluginShape) => c.transformStreamResultIn,
} as const

const pluginOutputAccessors = {
  transformQuery:        (c: KyselyPluginShape) => c.transformQueryOut,
  transformResult:       (c: KyselyPluginShape) => c.transformResultOut,
  transformStreamResult: (c: KyselyPluginShape) => c.transformStreamResultOut,
  error:                 (c: KyselyPluginShape) => c.errorOut,
} as const

export type KyselyPluginHole = ComponentHole<
  KyselyPluginShape,
  typeof pluginInputAccessors,
  typeof pluginOutputAccessors
>

// Creates a ComponentHole typed for KyselyPluginShape. Slot it immediately after creation.
export function makeKyselyPluginHole(): KyselyPluginHole {
  return new ComponentHole(pluginInputAccessors, pluginOutputAccessors)
}
