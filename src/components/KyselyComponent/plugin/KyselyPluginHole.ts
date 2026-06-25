import { Component } from '../../../channels/channel.js'
import { ComponentHole } from '../../../channels/component-hole.js'
import type { KyselyPlugin } from '../../../types/plugin/kysely-plugin.js'
import { KyselyPluginShape } from './KyselyPluginShape.js'
import { KyselyPluginComponent } from './KyselyPluginComponent.js'

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
