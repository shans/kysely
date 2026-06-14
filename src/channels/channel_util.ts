import { ChannelIn, ChannelOut, Component } from './channel.js'

export type StreamChunk<T> = { done: false; value: T } | { done: true }

// Wires start/next/end send callbacks and a chunk output channel into an
// AsyncIterableIterator factory. On first next(), calls sendStart (once) then
// sendNext; each subsequent next() calls only sendNext. The iterator's return()
// calls sendEnd for early termination / connection release.
export function asStreamingFunction<StartI, ChunkO>(
  sendStart: (payload: StartI, tags: Set<string>) => void,
  sendNext:  (tags: Set<string>) => void,
  sendEnd:   (tags: Set<string>) => void,
  chunkOut: ChannelOut<StreamChunk<ChunkO>>,
  error?:  ChannelOut<unknown>,
): (makeStart: (streamId: string) => StartI, extraTags?: Set<string>) => AsyncIterableIterator<ChunkO> {
  const pending = new Map<string, { resolve: (chunk: StreamChunk<ChunkO>) => void; reject: (e: unknown) => void }>()

  const chunkReceiver = new ChannelIn(new Component(), function(this: Component, chunk: StreamChunk<ChunkO>) {
    const tags = this._tags
    for (const tag of tags) {
      const p = pending.get(tag)
      if (p) { pending.delete(tag); p.resolve(chunk); break }
    }
  })
  chunkOut.connect(chunkReceiver)

  if (error) {
    const errorReceiver = new ChannelIn(new Component(), function(this: Component, err: unknown) {
      const tags = this._tags
      for (const tag of tags) {
        const p = pending.get(tag)
        if (p) { pending.delete(tag); p.reject(err); break }
      }
    })
    error.connect(errorReceiver)
  }

  return (makeStart: (streamId: string) => StartI, extraTags?: Set<string>): AsyncIterableIterator<ChunkO> => {
    const streamId = crypto.randomUUID()
    const tags = extraTags ? new Set([streamId, ...extraTags]) : new Set([streamId])
    const start = makeStart(streamId)
    let started = false
    let done = false

    return {
      [Symbol.asyncIterator]() { return this },

      next(): Promise<IteratorResult<ChunkO>> {
        if (done) return Promise.resolve({ value: undefined as any, done: true })
        return new Promise<StreamChunk<ChunkO>>((resolve, reject) => {
          pending.set(streamId, { resolve, reject })
          if (!started) {
            started = true
            sendStart(start, tags)  // sync: stores the generator object in the component
          }
          sendNext(tags)  // async: drives one step of the generator
        }).then(chunk => {
          if (chunk.done) { done = true; return { value: undefined as any, done: true as const } }
          return { value: chunk.value, done: false as const }
        })
      },

      return(): Promise<IteratorResult<ChunkO>> {
        if (!done) {
          done = true
          pending.delete(streamId)
          sendEnd(tags)
        }
        return Promise.resolve({ value: undefined as any, done: true as const })
      },
    }
  }
}
