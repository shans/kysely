import type { CompiledQuery } from '../query-compiler/compiled-query.js'

export type LogLevel = 'query' | 'error'

export interface QueryLogEvent {
  readonly level: 'query'
  readonly isStream?: boolean
  readonly query: CompiledQuery
  readonly queryDurationMillis: number
}

export interface ErrorLogEvent {
  readonly level: 'error'
  readonly error: unknown
  readonly query: CompiledQuery
  readonly queryDurationMillis: number
}

export type LogEvent = QueryLogEvent | ErrorLogEvent
export type Logger = (event: LogEvent) => void | Promise<void>
export type LogConfig = ReadonlyArray<LogLevel> | Logger
