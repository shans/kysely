import type { QueryResult } from '../../types/driver/database-connection.js'
import type { RootOperationNode } from '../../shared/operation-node/root-operation-node.js'
import type { CompiledQuery } from '../../types/query-compiler/compiled-query.js'
import type { KyselyPlugin } from '../../types/plugin/kysely-plugin.js'
import type { DatabaseMetadataOptions, TableMetadata, SchemaMetadata } from '../../types/dialect/database-introspector.js'
import type { AbortableOperationOptions } from '../../types/util/abort.js'
import type { StreamChunk } from '../../channels/channel_util.js'
import { Component, ChannelIn, ChannelOut } from '../../channels/channel.js'
import { KyselyEntryComponent } from './KyselyEntryComponent.js'
import { KyselyExecutorComponent, type TxAction, type ConnAction } from './KyselyExecutorComponent/KyselyExecutorComponent.js'
import { KyselyPluginComponent, CompositeKyselyPluginComponent, makeKyselyPluginHole, type KyselyPluginHole, type PluginResultArgs } from './plugin/index.js'
import type { KyselyCompilerShape } from './KyselyExecutorComponent/KyselyCompilerComponent.js'
import type { KyselyDriverShape } from './KyselyExecutorComponent/KyselyDriverComponent/KyselyDriverComponent.js'

export type { TxAction, ConnAction }

export interface KyselyComponentConfig {
  readonly DriverClass: new () => KyselyDriverShape
  readonly CompilerClass: new () => KyselyCompilerShape
  readonly plugins?: readonly KyselyPlugin[]
}

export interface StreamStartPayload {
  readonly streamId: string
  readonly node: RootOperationNode
  readonly chunkSize: number
  readonly options?: AbortableOperationOptions
}

export type StreamAction =
  | ({ kind: 'start' } & StreamStartPayload)
  | { kind: 'next' }
  | { kind: 'end' }

// Routes a unified StreamAction to the right subcomponent: 'start' goes to
// KyselyEntryComponent (needs transformQuery through the plugin hole), 'next'
// and 'end' go directly to KyselyExecutorComponent.
class StreamRouter extends Component {
  readonly streamIn = new ChannelIn<StreamAction>(this, this.route)
  readonly startOut = new ChannelOut<StreamStartPayload>()
  readonly nextOut  = new ChannelOut<void>()
  readonly endOut   = new ChannelOut<void>()

  private route(action: StreamAction): void {
    switch (action.kind) {
      case 'start': { const { kind: _, ...payload } = action; this.startOut.send(payload); break }
      case 'next':  this.nextOut.send(undefined as void); break
      case 'end':   this.endOut.send(undefined as void);  break
    }
  }
}

// Splits StreamChunk<PluginResultArgs> from the driver: done chunks go directly to
// doneChunkOut; non-done chunks have their PluginResultArgs extracted and forwarded
// to the plugin hole's transformStreamResult input.
class StreamChunkUnwrapper extends Component {
  readonly rawChunkIn      = new ChannelIn<StreamChunk<PluginResultArgs>>(this, this.route)
  readonly pluginResultOut = new ChannelOut<PluginResultArgs>()
  readonly doneChunkOut    = new ChannelOut<StreamChunk<QueryResult<unknown>>>()

  private route(chunk: StreamChunk<PluginResultArgs>): void {
    if (chunk.done) {
      this.doneChunkOut.send({ done: true })
    } else {
      this.pluginResultOut.send(chunk.value)
    }
  }
}

// Re-wraps a plugin-transformed QueryResult as a non-done StreamChunk so it can
// be merged with done chunks into the external streamChunkOut.
class StreamChunkWrapper extends Component {
  readonly transformedResultIn = new ChannelIn<QueryResult<unknown>>(this, this.wrap)
  readonly wrappedChunkOut     = new ChannelOut<StreamChunk<QueryResult<unknown>>>()

  private wrap(result: QueryResult<unknown>): void {
    this.wrappedChunkOut.send({ done: false, value: result })
  }
}

// Pure wiring container. Subcomponents that need no constructor config are field
// initializers; channels that depend only on those subcomponents are also single-line
// field initializers. The executor and its dependent channels are assigned in the
// constructor after holes are filled.
export class KyselyComponent extends Component {
  // Config-free subcomponents — field initializers so their channels can also be fields.
  private readonly entry          = new KyselyEntryComponent()
  private readonly hole           = makeKyselyPluginHole()
  private readonly streamRouter   = new StreamRouter()
  private readonly chunkUnwrapper = new StreamChunkUnwrapper()
  private readonly chunkWrapper   = new StreamChunkWrapper()
  // Executor needs config — assigned in constructor.
  private readonly executor: KyselyExecutorComponent

  // Entry-dependent forwarding inputs — single-line field declarations.
  readonly queryIn   = new ChannelIn<RootOperationNode>(this, this.entry.queryIn)
  readonly compileIn = new ChannelIn<RootOperationNode>(this, this.entry.compileIn)
  readonly streamIn  = new ChannelIn<StreamAction>(this, this.streamRouter.streamIn)

  // Hole-dependent forwarding output — single-line field declaration.
  readonly resultOut = new ChannelOut<QueryResult<unknown>>(this.hole.outputs.transformResult as unknown as ChannelOut<QueryResult<unknown>>)

  // Executor-dependent forwarding inputs — type declared here, assigned in constructor.
  readonly compiledIn: ChannelIn<CompiledQuery>
  readonly transactionIn: ChannelIn<TxAction>
  readonly connectionIn: ChannelIn<ConnAction>
  readonly destroyIn: ChannelIn<void>
  readonly getTablesIn: ChannelIn<DatabaseMetadataOptions | undefined>
  readonly getSchemasIn: ChannelIn<void>

  // Executor-dependent forwarding outputs.
  readonly compiledOut:    ChannelOut<CompiledQuery>
  readonly streamChunkOut: ChannelOut<StreamChunk<QueryResult<unknown>>>
  readonly errorOut:       ChannelOut<unknown>
  readonly tablesOut:      ChannelOut<TableMetadata[]>
  readonly schemasOut:     ChannelOut<SchemaMetadata[]>

  constructor(config: KyselyComponentConfig) {
    super()
    const ex = this.executor = new KyselyExecutorComponent()

    // Fill the dialect holes with fresh instances from the provided classes.
    ex.executeCompilerHole.slot.receive(new config.CompilerClass())
    ex.compileOnlyCompilerHole.slot.receive(new config.CompilerClass())
    ex.streamCompilerHole.slot.receive(new config.CompilerClass())
    ex.driverHole.slot.receive(new config.DriverClass())

    // Executor-dependent forwarding inputs.
    this.compiledIn    = new ChannelIn<CompiledQuery>(this, ex.compiledIn)
    this.transactionIn = new ChannelIn<TxAction>(this, ex.transactionIn)
    this.connectionIn  = new ChannelIn<ConnAction>(this, ex.connectionIn)
    this.destroyIn     = new ChannelIn<void>(this, ex.destroyIn)
    this.getTablesIn   = new ChannelIn<DatabaseMetadataOptions | undefined>(this, ex.getTablesIn)
    this.getSchemasIn  = new ChannelIn<void>(this, ex.getSchemasIn)

    // StreamRouter wiring: 'start' flows through entry (→ plugin hole → executor),
    // 'next' and 'end' go directly to the executor.
    this.streamRouter.startOut.connect(this.entry.streamStartIn)
    this.streamRouter.nextOut.connect(ex.streamNextIn)
    this.streamRouter.endOut.connect(ex.streamEndIn)

    // Executor-dependent forwarding outputs.
    this.compiledOut = new ChannelOut<CompiledQuery>(ex.compiledOut)

    // Stream chunk path through the plugin hole: driver emits StreamChunk<PluginResultArgs>;
    // non-done chunks are routed through hole.transformStreamResult for plugin application,
    // then re-wrapped as StreamChunk; done chunks bypass the hole and merge at streamChunkOut.
    ex.streamChunkOut.connect(this.chunkUnwrapper.rawChunkIn)
    this.chunkUnwrapper.pluginResultOut.connect(this.hole.inputs.transformStreamResult)
    ;(this.hole.outputs.transformStreamResult as unknown as ChannelOut<QueryResult<unknown>>).connect(this.chunkWrapper.transformedResultIn)
    this.streamChunkOut = new ChannelOut<StreamChunk<QueryResult<unknown>>>(
      this.chunkWrapper.wrappedChunkOut,
      this.chunkUnwrapper.doneChunkOut,
    )

    this.errorOut   = new ChannelOut<unknown>(this.entry.errorOut, this.hole.outputs.error, ex.errorOut)
    this.tablesOut  = new ChannelOut<TableMetadata[]>(ex.tablesOut)
    this.schemasOut = new ChannelOut<SchemaMetadata[]>(ex.schemasOut)

    // transformQuery routing: entry emits one channel per action with a tag added
    // by connectTagged; after the plugin hole transforms the node, connectFiltered
    // strips the tag and routes to the right executor input.
    this.entry.executeQueryOut.connectTagged('execute', this.hole.inputs.transformQuery)
    this.entry.compileQueryOut.connectTagged('compile', this.hole.inputs.transformQuery)
    this.entry.streamQueryOut.connectTagged('stream',   this.hole.inputs.transformQuery)
    this.hole.outputs.transformQuery.connectFiltered('execute', ex.executeQueryIn)
    this.hole.outputs.transformQuery.connectFiltered('compile', ex.compileQueryIn)
    this.hole.outputs.transformQuery.connectFiltered('stream',  ex.streamQueryIn)

    // transformResult: executor sends raw result into the plugin hole; the hole's
    // transformResult output is the external resultOut.
    ex.transformResultOut.connect(this.hole.inputs.transformResult)

    // Slot the plugin hole immediately; an empty plugin list yields a pass-through.
    const plugins = (config.plugins ?? []).map((p) => new KyselyPluginComponent(p))
    this.hole.slot.receive(new CompositeKyselyPluginComponent(plugins))
  }
}
