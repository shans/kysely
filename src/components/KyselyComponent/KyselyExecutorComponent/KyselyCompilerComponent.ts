import { ComponentHole } from '../../../channels/component-hole.js'
import type { KyselyCompilerShape } from './KyselyCompilerComponent/KyselyCompilerShape.js'

export type { KyselyCompilerShape }
export { KyselyBuiltinCompilerSlot } from './KyselyCompilerComponent/KyselyBuiltinCompilerSlot.js'
export { KyselyCustomCompilerSlot } from './KyselyCompilerComponent/KyselyCustomCompilerSlot.js'

const compilerInputAccessors = {
  in: (c: KyselyCompilerShape) => c.in,
} as const

const compilerOutputAccessors = {
  out:      (c: KyselyCompilerShape) => c.out,
  errorOut: (c: KyselyCompilerShape) => c.errorOut,
} as const

export type KyselyCompilerHole = ComponentHole<
  KyselyCompilerShape,
  typeof compilerInputAccessors,
  typeof compilerOutputAccessors
>

export function makeKyselyCompilerHole(): KyselyCompilerHole {
  return new ComponentHole(compilerInputAccessors, compilerOutputAccessors)
}
