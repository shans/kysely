import type { CompiledQuery } from '../../../types/query-compiler/compiled-query.js'
import type { DatabaseMetadataOptions, TableMetadata, SchemaMetadata } from '../../../types/dialect/database-introspector.js'
import type { StreamChunk } from '../../../channels/channel_util.js'
import type { TransformedQueryResult, PluginResultArgs } from '../../../types/plugin-types.js'
import { ChannelIn, ChannelOut, Component } from '../../../channels/channel.js'
import { makeKyselyDriverHole, type KyselyDriverHole, type TxAction, type ConnAction, type CompiledStreamPayload } from './KyselyDriverComponent/KyselyDriverComponent.js'
import { makeKyselyCompilerHole, type KyselyCompilerHole } from './KyselyCompilerComponent.js'

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
  // Holes — exposed publicly so KyselyComponent can fill them after construction.
  readonly executeCompilerHole:     KyselyCompilerHole = makeKyselyCompilerHole()
  readonly compileOnlyCompilerHole: KyselyCompilerHole = makeKyselyCompilerHole()
  readonly streamCompilerHole:      KyselyCompilerHole = makeKyselyCompilerHole()
  readonly driverHole:              KyselyDriverHole   = makeKyselyDriverHole()

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
  readonly streamChunkOut:     ChannelOut<StreamChunk<PluginResultArgs>>
  readonly errorOut:           ChannelOut<unknown>
  readonly tablesOut:          ChannelOut<TableMetadata[]>
  readonly schemasOut:         ChannelOut<SchemaMetadata[]>

  constructor() {
    super()
    const compExec    = this.executeCompilerHole
    const compCompile = this.compileOnlyCompilerHole
    const compStream  = this.streamCompilerHole
    const drv         = this.driverHole
    const bundler     = new KyselyStreamBundlerComponent()

    // Forwarding inputs — each query path routes through its own compiler hole.
    this.executeQueryIn = new ChannelIn<TransformedQueryResult>(this, compExec.inputs.in)
    this.compileQueryIn = new ChannelIn<TransformedQueryResult>(this, compCompile.inputs.in)
    // Stream path fans out: stream compiler fires first (sync compile → bundler.compiledIn),
    // then bundler.metaIn fires to complete the CompiledStreamPayload.
    this.streamQueryIn  = new ChannelIn<TransformedQueryResult>(this, compStream.inputs.in, bundler.metaIn)
    // Pre-compiled path bypasses all compilers and goes straight to the driver.
    this.compiledIn = new ChannelIn<CompiledQuery>(this, drv.inputs.executeIn)

    // Session and lifecycle inputs forward directly to the driver hole.
    this.transactionIn = new ChannelIn(this, drv.inputs.transactionIn)
    this.connectionIn  = new ChannelIn(this, drv.inputs.connectionIn)
    this.streamNextIn  = new ChannelIn<void>(this, drv.inputs.streamNextIn)
    this.streamEndIn   = new ChannelIn<void>(this, drv.inputs.streamEndIn)
    this.destroyIn     = new ChannelIn<void>(this, drv.inputs.destroyIn)
    this.getTablesIn   = new ChannelIn(this, drv.inputs.getTablesIn)
    this.getSchemasIn  = new ChannelIn<void>(this, drv.inputs.getSchemasIn)

    // Internal wiring.
    compExec.outputs.out.connect(drv.inputs.executeIn)
    compStream.outputs.out.connect(bundler.compiledIn)
    bundler.out.connect(drv.inputs.streamStartIn)

    // Forwarding outputs.
    this.compiledOut        = new ChannelOut<CompiledQuery>(compCompile.outputs.out)
    this.transformResultOut = new ChannelOut<PluginResultArgs>(drv.outputs.transformResultOut)
    this.streamChunkOut     = new ChannelOut<StreamChunk<PluginResultArgs>>(drv.outputs.streamChunkOut)
    this.errorOut           = new ChannelOut<unknown>(
      compExec.outputs.errorOut,
      compCompile.outputs.errorOut,
      compStream.outputs.errorOut,
      drv.outputs.errorOut,
    )
    this.tablesOut  = new ChannelOut<TableMetadata[]>(drv.outputs.tablesOut)
    this.schemasOut = new ChannelOut<SchemaMetadata[]>(drv.outputs.schemasOut)
  }
}
