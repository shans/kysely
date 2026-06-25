import { ChannelIn, ChannelOut, ChannelReceiver, Component } from './channel.js'

type HoleInputPayload<C, A> = A extends (c: C) => ChannelReceiver<infer E> ? E : never
type HoleOutputPayload<C, A> = A extends (c: C) => ChannelOut<infer E> ? E : never

export type HoleInputs<
  C extends Component,
  IA extends Record<string, (c: C) => ChannelReceiver<any>>
> = { [K in keyof IA]: ChannelIn<HoleInputPayload<C, IA[K]>> }

export type HoleOutputs<
  C extends Component,
  OA extends Record<string, (c: C) => ChannelOut<any>>
> = { [K in keyof OA]: ChannelOut<HoleOutputPayload<C, OA[K]>> }

// Bridges one output of the slotted component to the hole's external ChannelOut.
class HoleBridge<E> extends Component {
  readonly bridgeIn = new ChannelIn<E>(this, this.forward)
  readonly out = new ChannelOut<E>()

  private forward(v: E): void {
    this.out.send(v)
  }
}

// A ChannelReceiver<C> whose only action is slotting C into its owning ComponentHole.
// Cannot be constructed without a ComponentHole — enforcing the invariant that
// components are never handled directly, only slotted.
export class ComponentSlotIn<C extends Component> extends ChannelReceiver<C> {
  constructor(private readonly hole: ComponentHole<C, any, any>) {
    super(hole)
    // Arrow function so `this.hole` always refers to the ComponentSlotIn instance,
    // regardless of the `this` rebinding performed by ChannelReceiver.receive.
    this.receiverFns.push((c: C) => this.hole._onSlot(c))
  }
}

// A Component that wraps a dynamic slot. The slot holds one component of type C at
// a time; messages sent to its inputs are forwarded to the slotted component, and
// the slotted component's outputs are forwarded to the hole's outputs. Re-slotting
// (sending a new component to `slot`) disconnects the old component and connects
// the new one — this is not dynamic wiring, the channel connections themselves
// are permanent.
export class ComponentHole<
  C extends Component,
  IA extends Record<string, (c: C) => ChannelReceiver<any>>,
  OA extends Record<string, (c: C) => ChannelOut<any>>
> extends Component {
  readonly slot: ComponentSlotIn<C>
  readonly inputs: HoleInputs<C, IA>
  readonly outputs: HoleOutputs<C, OA>

  private current: C | null = null
  private readonly bridges: Record<string, HoleBridge<any>>
  private readonly outputAccessors: OA

  constructor(inputAccessors: IA, outputAccessors: OA) {
    super()
    this.outputAccessors = outputAccessors
    this.slot = new ComponentSlotIn(this)

    // Build one bridge per output key.
    const bridges: Record<string, HoleBridge<any>> = {}
    const outputs: Record<string, ChannelOut<any>> = {}
    for (const key of Object.keys(outputAccessors)) {
      const bridge = new HoleBridge<any>()
      bridges[key] = bridge
      outputs[key] = bridge.out
    }
    this.bridges = bridges
    this.outputs = outputs as HoleOutputs<C, OA>

    // Build one ChannelIn per input key. `this` (the hole) is the owner, so
    // the ComponentContext proxy inside each handler sees the hole's own channels.
    const hole = this
    const inputs: Record<string, ChannelIn<any>> = {}
    for (const key of Object.keys(inputAccessors)) {
      const k = key
      inputs[k] = new ChannelIn<any>(this, function(this: any, v: any) {
        if (!hole.current) throw new Error(`ComponentHole: no component slotted (input: ${k})`)
        // `this` is the ComponentContext proxy over the hole; _tags and _promises carry
        // the correlation tags and promise accumulator for the in-flight message.
        const tags = (this as any)._tags as Set<string> | undefined
        const promises = (this as any)._promises as Promise<void>[] | undefined
        inputAccessors[k](hole.current).receive(v, tags, promises)
      })
    }
    this.inputs = inputs as HoleInputs<C, IA>
  }

  // Called by ComponentSlotIn when a component is received.
  _onSlot(component: C): void {
    if (this.current) {
      for (const key of Object.keys(this.outputAccessors)) {
        this.outputAccessors[key](this.current).disconnect(this.bridges[key].bridgeIn)
      }
    }
    this.current = component
    for (const key of Object.keys(this.outputAccessors)) {
      this.outputAccessors[key](component).connect(this.bridges[key].bridgeIn)
    }
  }
}
