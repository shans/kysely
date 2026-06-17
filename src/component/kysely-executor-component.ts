import type { QueryResult } from '../driver/database-connection.js'
import type { CompiledQuery } from '../query-compiler/compiled-query.js'
import type { DatabaseMetadataOptions, TableMetadata, SchemaMetadata } from '../dialect/database-introspector.js'
import type { StreamChunk } from '../channels/channel_util.js'
import type { TransformedQueryResult, PluginResultArgs } from './plugin-component.js'
import type { KyselyComponentConfig } from './kysely-component.js'
import { ChannelIn, ChannelOut, Component } from '../channels/channel.js'
import { KyselyDriverComponent, type TxAction, type ConnAction, type CompiledStreamPayload } from './kysely-driver-component.js'
import { KyselyCompilerComponent } from './kysely-compiler-component.js'
import { RuntimeDriver } from '../driver/runtime-driver.js'

export type { TxAction, ConnAction }

// Correlates CompiledQuery (from the stream compiler) with StreamMeta (from the fan-out on
// streamQueryIn). compiledIn fires first because compilation is synchronous and the compiler
// is listed before metaIn in the streamQueryIn receiver list. Connection order is load-bearing;
// see TODO task 11 (pass-through primitive).
class KyselyStreamBundlerComponent extends Component {
  readonly compiledIn = new ChannelIn<CompiledQuery>(this, this.setCompiled)
  readonly metaIn     = new ChannelIn<TransformedQueryResult>(this, this.bundle)
  readonly out        = new ChannelOut<CompiledStreamPayload>()

  private pending: CompiledQuery | undefined

  private setCompiled(compiled: CompiledQuery): void {
    this.pending = compiled
  }

  private bundle({ streamMeta }: TransformedQueryResult): void {
    if (!streamMeta || !this.pending) return
    this.out.send({ compiled: this.pending, ...streamMeta })
    this.pending = undefined
  }
}

export class KyselyExecutorComponent extends Component {
  readonly executeQueryIn: ChannelIn<TransformedQueryResult>
  readonly compileQueryIn: ChannelIn<TransformedQueryResult>
  readonly streamQueryIn:  ChannelIn<TransformedQueryResult>
  readonly compiledIn:     ChannelIn<CompiledQuery>

  readonly transactionIn: ChannelIn<TxAction>
  readonly connectionIn:  ChannelIn<ConnAction>
  readonly streamNextIn:  ChannelIn<void>
  readonly streamEndIn:   ChannelIn<void>
  readonly destroyIn:     ChannelIn<void>
  readonly getTablesIn:   ChannelIn<DatabaseMetadataOptions | undefined>
  readonly getSchemasIn:  ChannelIn<void>

  readonly transformResultOut: ChannelOut<PluginResultArgs>
  readonly compiledOut:        ChannelOut<CompiledQuery>
  readonly streamChunkOut:     ChannelOut<StreamChunk<QueryResult<unknown>>>
  readonly errorOut:           ChannelOut<unknown>
  readonly tablesOut:          ChannelOut<TableMetadata[]>
  readonly schemasOut:         ChannelOut<SchemaMetadata[]>

  readonly driver: RuntimeDriver

  constructor(config: KyselyComponentConfig) {
    super()
    const drv                 = new KyselyDriverComponent(config)
    const executeCompiler     = new KyselyCompilerComponent(drv.compileQueryFn)
    const compileOnlyCompiler = new KyselyCompilerComponent(drv.compileQueryFn)
    const streamCompiler      = new KyselyCompilerComponent(drv.compileQueryFn)
    const streamBundler       = new KyselyStreamBundlerComponent()

    // Forwarding inputs — each query path routes through its own compiler instance.
    this.executeQueryIn = new ChannelIn<TransformedQueryResult>(this, executeCompiler.in)
    this.compileQueryIn = new ChannelIn<TransformedQueryResult>(this, compileOnlyCompiler.in)
    // Stream path fans out: streamCompiler.in fires first (sync compile → bundler.compiledIn),
    // then bundler.metaIn fires to complete the CompiledStreamPayload.
    this.streamQueryIn  = new ChannelIn<TransformedQueryResult>(this, streamCompiler.in, streamBundler.metaIn)
    // Pre-compiled path bypasses all compilers and goes straight to the driver.
    this.compiledIn = new ChannelIn<CompiledQuery>(this, drv.executeIn)

    // Session and lifecycle inputs forward directly to the driver.
    this.transactionIn = new ChannelIn(this, drv.transactionIn)
    this.connectionIn  = new ChannelIn(this, drv.connectionIn)
    this.streamNextIn  = new ChannelIn<void>(this, drv.streamNextIn)
    this.streamEndIn   = new ChannelIn<void>(this, drv.streamEndIn)
    this.destroyIn     = new ChannelIn<void>(this, drv.destroyIn)
    this.getTablesIn   = new ChannelIn(this, drv.getTablesIn)
    this.getSchemasIn  = new ChannelIn<void>(this, drv.getSchemasIn)

    // Internal wiring.
    executeCompiler.out.connect(drv.executeIn)
    streamCompiler.out.connect(streamBundler.compiledIn)
    streamBundler.out.connect(drv.streamStartIn)

    // Forwarding outputs.
    this.compiledOut        = new ChannelOut<CompiledQuery>(compileOnlyCompiler.out)
    this.transformResultOut = new ChannelOut<PluginResultArgs>(drv.transformResultOut)
    this.streamChunkOut     = new ChannelOut<StreamChunk<QueryResult<unknown>>>(drv.streamChunkOut)
    this.errorOut           = new ChannelOut<unknown>(
      executeCompiler.errorOut,
      compileOnlyCompiler.errorOut,
      streamCompiler.errorOut,
      drv.errorOut,
    )
    this.tablesOut  = new ChannelOut<TableMetadata[]>(drv.tablesOut)
    this.schemasOut = new ChannelOut<SchemaMetadata[]>(drv.schemasOut)

    this.driver = drv.driver
  }
}
