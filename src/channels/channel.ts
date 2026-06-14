export type ReceiverFn<E> = ((entity: E & any) => void) | ((entity: E & any) => Promise<void>);

export class ChannelOut<E> {
  senders: ChannelOut<E>[] = [];
  watchers: ReceiverFn<E>[] = [];
  receivers: {tag?: string, filter?: string, receiver: ChannelReceiver<E>}[] = [];
  passThrough = false;

  constructor(...senders: ChannelOut<E>[]) {
    this.senders = senders;
  }

  static pass<E>(sender: ChannelOut<E>, ...senders: ChannelOut<E>[]): ChannelOut<E> {
    const channel = new ChannelOut<E>(sender, ...senders);
    channel.passThrough = true;
    return channel;
  }

  watch(fn: ReceiverFn<E>): void {
    this.watchers.push(fn);
  }

  unwatch(fn: ReceiverFn<E>): void {
    const idx = this.watchers.indexOf(fn);
    console.assert(idx >= 0);
    this.watchers.splice(idx, 1);
  }

  connect(...receivers: ChannelReceiver<E>[]): ChannelOut<E> {
    for (const receiver of receivers) {
      this.receivers.push({receiver});
    }
    for (const sender of this.senders) {
      sender.connect(...receivers);
    }
    return this;
  }

  // TODO(feature): Should be able to add a set of tags and/or a set of
  // filters, all on the same connection.
  connectTagged(tag: string, ...receivers: ChannelReceiver<E>[]): ChannelOut<E> {
    for (const receiver of receivers) {
      this.receivers.push({tag, receiver});
    }
    for (const sender of this.senders) {
      sender.connectTagged(tag, ...receivers);
    }
    return this;
  }

  connectFiltered(filter: string, ...receivers: ChannelReceiver<E>[]): ChannelOut<E> {
    for (const receiver of receivers) {
      this.receivers.push({filter, receiver});
    }
    for (const sender of this.senders) {
      sender.connectFiltered(filter, ...receivers);
    }
    return this;
  }

  send(entity: E, tags?: Set<string>, promises?: Promise<void>[]): void {
    if (this.passThrough) {
      throw new Error(`send invoked on a pure passThrough ChannelOut`);
    }
    if (this.receivers.length === 0 && this.watchers.length == 0) {
      // TODO(cleanup): Should this actually be an error?
      // throw new Error(`send invoked on a ChannelOut with no receivers attached`);
    }

    const accum = (r: void | Promise<void>) => (typeof(r) == 'object' && 'then' in r) ? promises?.push(r) : {};

    for (const {tag, filter, receiver} of this.receivers) {
      const allTags = new Set(tags? [...tags] : []);
      if (tag) {
        allTags.add(tag);
      }
      if (filter) {
        if (allTags.has(filter)) {
          allTags.delete(filter);
        } else {
          continue;
        }
      }
      accum(receiver.receive(entity, allTags, promises));
    }
    for (const watcher of this.watchers) {
      watcher(entity);
    }
  }

  async sendAndWait(entity: E, tags?: Set<string>, promises?: Promise<void>[]): Promise<void> {
    const subPromises: Promise<void>[] = [];
    this.send(entity, tags, subPromises);
    while (subPromises.length > 0) {
      await Promise.all(subPromises.splice(0, subPromises.length));
    }
  }

  disconnect(receiver: ChannelReceiver<E>): void {
    const idx = this.receivers.findIndex(r => r.receiver === receiver)
    if (idx >= 0) this.receivers.splice(idx, 1)
    for (const sender of this.senders) {
      sender.disconnect(receiver)
    }
  }

  // Indicates that this ChannelOut is intentionally not being connected to any receivers.
  // This prevents an error being thrown when send() is invoked.
  cap(): ChannelOut<E> {
    this.watchers.push(() => {});
    return this;
  }
}

export abstract class ChannelReceiver<E> {
  receiverFns: ReceiverFn<E>[] = [];
  receivers: ChannelReceiver<E>[] = [];
  proxiedChannel: ChannelOut<E> | null = null;

  constructor(private owner: Component) {}

  inject(i: E, tags?: Set<string>): void {
    this.receive(i, tags);
  }

  async injectAndWait(i: E, tags?: Set<string>): Promise<void> {
    const subPromises: Promise<void>[] = []
    this.receive(i, tags, subPromises)
    while (subPromises.length > 0) {
      await Promise.all(subPromises.splice(0, subPromises.length))
    }
  }

  receive(i: E, tags?: Set<string>, promises?: Promise<void>[]): void | Promise<void> {
    if (this.receiverFns.length == 0 && this.receivers.length == 0) {
      throw new Error(`receive invoked on a ChannelIn with no receiver functions attached`);
    }
    const context = new Proxy(this.owner, new ComponentContext(promises, tags));
    const accum = (r: void | Promise<void>) => (typeof(r) == 'object' && 'then' in r) ? promises?.push(r) : {};
    this.receiverFns.forEach(f => accum(f.bind(context)(i)));
    this.receivers.forEach(r => accum(r.receive(i, tags, promises)));
  }
}

export class ChannelIn<E> extends ChannelReceiver<E> {
  constructor(owner: Component, ...receivers: (ReceiverFn<E> | ChannelReceiver<E>)[]) {
    super(owner);
    for (const receiver of receivers) {
      if (typeof receiver === 'function') {
        this.receiverFns.push(receiver);
      } else {
        this.receivers.push(receiver);
      }
    }
  }
}

export class DataChannel<E> extends ChannelReceiver<E> {
  constructor(owner: Component, private data: E | null = null) {
    super(owner);
    this.receiverFns.push(data => (this.data = data));
  }

  getNullable(): E | null {
    return this.data;
  }

  get(): E {
    if (this.data === null) {
      throw new Error('DataChannel has not received data yet');
    }
    return this.data;
  }
}

// UUID-per-call correlation is used here rather than a simpler sendAndWait + watcher approach.
// sendAndWait correctly isolates the promise chain per call (each call's subPromises array
// accumulates only its own handler's work), but it does not help with output routing: when
// two calls are concurrent, resultOut.send fires for all registered watchers, so each watcher
// sees every result and cannot tell which belongs to it. The UUID tag threads through
// ComponentContext automatically, so it arrives on the output alongside the result and lets
// the receiver route to exactly the right pending Promise.
export function asAsyncFunction<I, O>(
  input: ChannelIn<I>,
  output: ChannelOut<O>,
  error?: ChannelOut<unknown>,
): (i: I, extraTags?: Set<string>) => Promise<O> {
  const pending = new Map<string, { resolve: (v: O) => void; reject: (e: unknown) => void }>()

  const resultReceiver = new ChannelIn(new Component(), function (this: Component, result: O) {
    const tags = this._tags
    for (const tag of tags) {
      const p = pending.get(tag)
      if (p) { pending.delete(tag); p.resolve(result); break }
    }
  })
  output.connect(resultReceiver)

  if (error) {
    const errorReceiver = new ChannelIn(new Component(), function (this: Component, err: unknown) {
      const tags = this._tags
      for (const tag of tags) {
        const p = pending.get(tag)
        if (p) { pending.delete(tag); p.reject(err); break }
      }
    })
    error.connect(errorReceiver)
  }

  return (i: I, extraTags?: Set<string>): Promise<O> => {
    const correlationId = crypto.randomUUID()
    const tags = extraTags
      ? new Set([correlationId, ...extraTags])
      : new Set([correlationId])
    return new Promise<O>((resolve, reject) => {
      pending.set(correlationId, { resolve, reject })
      input.receive(i, tags)
    })
  }
}

// For synchronous handlers only. Uses input.receive() so handlers are correctly
// bound to their ComponentContext proxy (fixes the bug where direct receiverFns
// calls would leave `this` unbound inside component methods).
export function asFunction<I, O>(input: ChannelIn<I>, output: ChannelOut<O>): (i: I) => O  {
  let returnVal: O[] = [];

  const innerChannel = new ChannelIn(new Component(), (o: O): void => {
    returnVal.push(o);
  });
  output.connect(innerChannel);

  return function (i: I): O {
    returnVal = [];
    input.receive(i);
    if (returnVal.length != 1) {
      // TODO(cleanup): Improve error message here.
      throw new Error(`Use function exception, unexpected results: ${returnVal.map(x => `"""\n${x}\n"""`).join("\n")}`);
    }
    return returnVal[0];
  };
}

export type ComponentOptions<C> = {
  name?: string,
  config?: ChannelOut<C>,
  currentConfig?: C,
};

export class Component<C extends object=object> {
  // TODO(cleanup): Use symbols for these so there can't be collision.
  _name: string;
  // shadow definition in Component so everything typechecks
  // in the presence of proxies.
  _tags!: Set<string>;

  constructor(private options: ComponentOptions<C> = {}){
    if (options === undefined || options.name === undefined) {
      this._name = this.constructor.name;
    } else {
      this._name = options.name;
    }
  }
}

export class ComponentContext {
  _tags: Set<string>;
  _promises?: Promise<void>[];

  constructor(promises?: Promise<void>[], tags?: Set<string>) {
    this._tags = new Set(tags ? [...tags] : []);
    this._promises = promises;
  }

  get(target: Component, prop: string) {
    if (prop == '_tags') {
        return this._tags;
    }

    const v = (target as any)[prop];

    if (v instanceof ChannelOut) {
        return new Proxy(v, new ChannelOutContext(this));
    }

    return v;
  }
}

class ChannelOutContext<T> {
  constructor(private component: ComponentContext) {}

  get(target: ChannelOut<T>, prop: string){
      if (prop == 'send') {
          return (v: T) => {
            const r = target.send(v, this.component._tags, this.component._promises);
          }
      }
      if (prop == 'sendAndWait') {
        return (v: T) => {
          const r = target.sendAndWait(v, this.component._tags, this.component._promises);
          this.component._promises?.push(r);
          return r;
        }
      }
      return (target as any)[prop];
  }
}
