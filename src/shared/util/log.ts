// Runtime-only: the Log class, LOG_LEVELS const, and defaultLogger function
// survive TypeScript compilation and belong in shared/. The type aliases and
// interfaces (LogLevel, Logger, LogConfig, QueryLogEvent, ErrorLogEvent, LogEvent)
// are erased at compile time and live in types/util/log.ts.
import { freeze, isFunction } from '../../util/object-utils.js'
import type {
  LogLevel,
  Logger,
  LogConfig,
  QueryLogEvent,
  ErrorLogEvent,
} from '../../types/util/log.js'

const logLevels = ['query', 'error'] as const
export const LOG_LEVELS: Readonly<typeof logLevels> = freeze(logLevels)

export class Log {
  readonly #levels: Readonly<Record<LogLevel, boolean>>
  readonly #logger: Logger

  constructor(config: LogConfig) {
    if (isFunction(config)) {
      this.#logger = config

      this.#levels = freeze({
        query: true,
        error: true,
      })
    } else {
      this.#logger = defaultLogger

      this.#levels = freeze({
        query: config.includes('query'),
        error: config.includes('error'),
      })
    }
  }

  isLevelEnabled(level: LogLevel): boolean {
    return this.#levels[level]
  }

  async query(getEvent: () => QueryLogEvent) {
    if (this.#levels.query) {
      await this.#logger(getEvent())
    }
  }

  async error(getEvent: () => ErrorLogEvent) {
    if (this.#levels.error) {
      await this.#logger(getEvent())
    }
  }
}

function defaultLogger(event: QueryLogEvent | ErrorLogEvent): void {
  if (event.level === 'query') {
    const prefix = `kysely:query:${event.isStream ? 'stream:' : ''}`
    console.log(`${prefix} ${event.query.sql}`)
    console.log(`${prefix} duration: ${event.queryDurationMillis.toFixed(1)}ms`)
  } else if (event.level === 'error') {
    if (event.error instanceof Error) {
      console.error(`kysely:error: ${event.error.stack ?? event.error.message}`)
    } else {
      console.error(
        `kysely:error: ${JSON.stringify({
          error: event.error,
          query: event.query.sql,
          queryDurationMillis: event.queryDurationMillis,
        })}`,
      )
    }
  }
}
