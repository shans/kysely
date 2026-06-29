import { ComponentHole } from '../../../../channels/component-hole.js'
import type { KyselyDriverShape } from './KyselyDriverShape.js'

export type { KyselyDriverShape }
export type { TxAction, ConnAction, CompiledStreamPayload } from './KyselyDriverShape.js'
export { KyselyCustomDriverSlot } from './KyselyCustomDriverSlot.js'

const driverInputAccessors = {
  executeIn:     (c: KyselyDriverShape) => c.executeIn,
  streamStartIn: (c: KyselyDriverShape) => c.streamStartIn,
  streamNextIn:  (c: KyselyDriverShape) => c.streamNextIn,
  streamEndIn:   (c: KyselyDriverShape) => c.streamEndIn,
  transactionIn: (c: KyselyDriverShape) => c.transactionIn,
  connectionIn:  (c: KyselyDriverShape) => c.connectionIn,
  destroyIn:     (c: KyselyDriverShape) => c.destroyIn,
  getTablesIn:   (c: KyselyDriverShape) => c.getTablesIn,
  getSchemasIn:  (c: KyselyDriverShape) => c.getSchemasIn,
} as const

const driverOutputAccessors = {
  transformResultOut: (c: KyselyDriverShape) => c.transformResultOut,
  streamChunkOut:     (c: KyselyDriverShape) => c.streamChunkOut,
  errorOut:           (c: KyselyDriverShape) => c.errorOut,
  tablesOut:          (c: KyselyDriverShape) => c.tablesOut,
  schemasOut:         (c: KyselyDriverShape) => c.schemasOut,
} as const

export type KyselyDriverHole = ComponentHole<
  KyselyDriverShape,
  typeof driverInputAccessors,
  typeof driverOutputAccessors
>

export function makeKyselyDriverHole(): KyselyDriverHole {
  return new ComponentHole(driverInputAccessors, driverOutputAccessors)
}
