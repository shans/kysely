import type { DatabaseConnection } from './database-connection.js'
import type { QueryCompiler } from '../query-compiler/query-compiler.js'
import type { AbortableOperationOptions } from '../util/abort.js'

export type AccessMode = 'read only' | 'read write'

export type IsolationLevel =
  | 'read uncommitted'
  | 'read committed'
  | 'repeatable read'
  | 'serializable'
  | 'snapshot'

export interface TransactionSettings {
  readonly accessMode?: AccessMode
  readonly isolationLevel?: IsolationLevel
}

/**
 * A Driver creates and releases {@link DatabaseConnection | database connections}
 * and is also responsible for connection pooling (if the dialect supports pooling).
 */
export interface Driver {
  /**
   * Initializes the driver.
   *
   * After calling this method the driver should be usable and `acquireConnection` etc.
   * methods should be callable.
   */
  init(options?: AbortableOperationOptions): Promise<void>

  /**
   * Acquires a new connection from the pool.
   */
  acquireConnection(options?: AbortableOperationOptions): Promise<DatabaseConnection>

  /**
   * Begins a transaction.
   */
  beginTransaction(
    connection: DatabaseConnection,
    settings: TransactionSettings,
  ): Promise<void>

  /**
   * Commits a transaction.
   */
  commitTransaction(connection: DatabaseConnection): Promise<void>

  /**
   * Rolls back a transaction.
   */
  rollbackTransaction(connection: DatabaseConnection): Promise<void>

  /**
   * Establishes a new savepoint within a transaction.
   */
  savepoint?(
    connection: DatabaseConnection,
    savepointName: string,
    compileQuery: QueryCompiler['compileQuery'],
  ): Promise<void>

  /**
   * Rolls back to a savepoint within a transaction.
   */
  rollbackToSavepoint?(
    connection: DatabaseConnection,
    savepointName: string,
    compileQuery: QueryCompiler['compileQuery'],
  ): Promise<void>

  /**
   * Releases a savepoint within a transaction.
   */
  releaseSavepoint?(
    connection: DatabaseConnection,
    savepointName: string,
    compileQuery: QueryCompiler['compileQuery'],
  ): Promise<void>

  /**
   * Releases a connection back to the pool.
   */
  releaseConnection(
    connection: DatabaseConnection,
    options?: AbortableOperationOptions,
  ): Promise<void>

  /**
   * Destroys the driver and releases all resources.
   */
  destroy(options?: AbortableOperationOptions): Promise<void>
}
