import type { QueryCreator } from './codeView/QueryCreator.js'
import type { SchemaModule } from './codeView/schema/schema-module.js'
import type { DynamicModule } from './codeView/dynamic/dynamic.js'
import type { FunctionModule } from './codeView/query-builder/function-module.js'
import type { QueryExecutor } from './query-executor/query-executor.js'
import type { DatabaseIntrospector } from './types/dialect/database-introspector.js'
import type { KyselyPlugin } from './types/plugin/kysely-plugin.js'
import type { CaseBuilder } from './codeView/query-builder/case-builder.js'
import type { Expression } from './codeView/expression/expression.js'
import type { DrainOuterGeneric } from './types/util/type-utils.js'
import type { QueryResult } from './types/driver/database-connection.js'
import type { CompiledQuery } from './types/query-compiler/compiled-query.js'
import type { Compilable } from './util/compilable.js'
import type { IsolationLevel, AccessMode, Driver } from './types/driver/driver.js'
import type { Dialect } from './types/dialect/dialect.js'
import type { ReleaseSavepoint, RollbackToSavepoint } from './shared/parser/savepoint-parser.js'
import type { AbortableOperationOptions, AbortableQueryOptions } from './types/util/abort.js'
import type { LogConfig } from './types/util/log.js'
import { isObject } from './util/object-utils.js'

declare global {
  interface AsyncDisposable {}
  interface SymbolConstructor {
    readonly asyncDispose: unique symbol
  }
}

// @ts-ignore
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose')

export interface Kysely<DB> extends QueryCreator<DB> {
  get schema(): SchemaModule
  get dynamic(): DynamicModule<DB>
  get introspection(): DatabaseIntrospector
  case(): CaseBuilder<DB, keyof DB>
  case<V>(value: Expression<V>): CaseBuilder<DB, keyof DB, V>
  get fn(): FunctionModule<DB, keyof DB>
  transaction(): TransactionBuilder<DB>
  startTransaction(): ControlledTransactionBuilder<DB>
  connection(): ConnectionBuilder<DB>
  withPlugin(plugin: KyselyPlugin): Kysely<DB>
  withoutPlugins(): Kysely<DB>
  withSchema(schema: string): Kysely<DB>
  $extendTables<T extends Record<string, Record<string, any>>>(): Kysely<DrainOuterGeneric<DB & T>>
  $omitTables<T extends keyof DB>(): Kysely<DB extends object ? Omit<DB, T> : DB>
  $pickTables<T extends keyof DB>(): Kysely<DB extends object ? Pick<DB, T> : DB>
  /** @deprecated use {@link $extendTables} instead. */
  withTables<T extends Record<string, Record<string, any>>>(): Kysely<DrainOuterGeneric<DB & T>>
  destroy(): Promise<void>
  get isTransaction(): boolean
  getExecutor(): QueryExecutor
  executeQuery<R>(query: CompiledQuery<R> | Compilable<R>, options?: AbortableQueryOptions): Promise<QueryResult<R>>
  [Symbol.asyncDispose](): Promise<void>
}

export interface Transaction<DB> extends Kysely<DB> {
  get isTransaction(): true
  transaction(): never
  startTransaction(): never
  connection(): never
  destroy(): never
  withPlugin(plugin: KyselyPlugin): Transaction<DB>
  withoutPlugins(): Transaction<DB>
  withSchema(schema: string): Transaction<DB>
  $extendTables<T extends Record<string, Record<string, any>>>(): Transaction<DrainOuterGeneric<DB & T>>
  $omitTables<T extends keyof DB>(): Transaction<DB extends object ? Omit<DB, T> : DB>
  $pickTables<T extends keyof DB>(): Transaction<DB extends object ? Pick<DB, T> : DB>
  /** @deprecated use {@link $extendTables} instead. */
  withTables<T extends Record<string, Record<string, any>>>(): Transaction<DrainOuterGeneric<DB & T>>
}

export interface ControlledTransaction<DB, S extends string[] = []> extends Transaction<DB> {
  readonly isCommitted: boolean
  readonly isRolledBack: boolean
  commit(): Command<void>
  rollback(): Command<void>
  savepoint<SN extends string>(
    savepointName: SN extends S ? never : SN,
  ): Command<ControlledTransaction<DB, [...S, SN]>>
  rollbackToSavepoint<SN extends S[number]>(
    savepointName: SN,
  ): RollbackToSavepoint<S, SN> extends string[]
    ? Command<ControlledTransaction<DB, RollbackToSavepoint<S, SN>>>
    : never
  releaseSavepoint<SN extends S[number]>(
    savepointName: SN,
  ): ReleaseSavepoint<S, SN> extends string[]
    ? Command<ControlledTransaction<DB, ReleaseSavepoint<S, SN>>>
    : never
  withPlugin(plugin: KyselyPlugin): ControlledTransaction<DB, S>
  withoutPlugins(): ControlledTransaction<DB, S>
  withSchema(schema: string): ControlledTransaction<DB, S>
  $extendTables<T extends Record<string, Record<string, any>>>(): ControlledTransaction<DrainOuterGeneric<DB & T>, S>
  $omitTables<T extends keyof DB>(): ControlledTransaction<DB extends object ? Omit<DB, T> : DB, S>
  $pickTables<T extends keyof DB>(): ControlledTransaction<DB extends object ? Pick<DB, T> : DB, S>
  /** @deprecated use {@link $extendTables} instead. */
  withTables<T extends Record<string, Record<string, any>>>(): ControlledTransaction<DrainOuterGeneric<DB & T>, S>
}

export interface TransactionBuilder<DB> {
  setAccessMode(accessMode: AccessMode): TransactionBuilder<DB>
  setIsolationLevel(isolationLevel: IsolationLevel): TransactionBuilder<DB>
  execute<T>(callback: (trx: Transaction<DB>) => Promise<T>): Promise<T>
}

export interface ControlledTransactionBuilder<DB> {
  setAccessMode(accessMode: AccessMode): ControlledTransactionBuilder<DB>
  setIsolationLevel(isolationLevel: IsolationLevel): ControlledTransactionBuilder<DB>
  execute(): Promise<ControlledTransaction<DB>>
}

export interface ConnectionBuilder<DB> {
  execute<T>(
    callback: (db: Kysely<DB>) => Promise<T>,
    options?: AbortableOperationOptions,
  ): Promise<T>
}

export interface Command<T> {
  execute(): Promise<T>
}

export interface KyselyConfig {
  readonly dialect: Dialect
  readonly plugins?: KyselyPlugin[]
  readonly log?: LogConfig
}

export interface KyselyProps {
  readonly config: KyselyConfig
  readonly driver: Driver
  readonly executor: QueryExecutor
  readonly dialect: Dialect
}

export function isKyselyProps(obj: unknown): obj is KyselyProps {
  return (
    isObject(obj) &&
    isObject(obj.config) &&
    isObject(obj.driver) &&
    isObject(obj.executor) &&
    isObject(obj.dialect)
  )
}
