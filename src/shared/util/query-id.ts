// Runtime-only: the createQueryId factory and its LazyQueryId implementation
// survive TypeScript compilation and belong in shared/. The QueryId interface
// is erased at compile time and lives in types/util/query-id.ts.
import { randomString } from '../../util/random-string.js'
import type { QueryId } from '../../types/util/query-id.js'

export function createQueryId(): QueryId {
  return new LazyQueryId()
}

class LazyQueryId implements QueryId {
  #queryId: string | undefined

  get queryId(): string {
    if (this.#queryId === undefined) {
      this.#queryId = randomString(8)
    }

    return this.#queryId
  }
}
