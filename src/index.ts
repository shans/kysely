/**
 * @module
 * @mergeModuleWith <project>
 */

import type { KyselyTypeError } from './util/type-error.js'

export { Kysely } from './api.js'
export type { KyselyProps, KyselyConfig, Transaction, ConnectionBuilder, TransactionBuilder, ControlledTransactionBuilder, ControlledTransaction, Command } from './transaction-types.js'
export { isKyselyProps } from './transaction-types.js'
export * from './codeView/QueryCreator.js'
export * from './query-finalizer.js'

export * from './expression/expression.js'
export {
  type ExpressionBuilder,
  expressionBuilder,
} from './expression/expression-builder.js'
export * from './expression/expression-wrapper.js'

export type * from './query-builder/where-interface.js'
export type * from './query-builder/returning-interface.js'
export type * from './query-builder/output-interface.js'
export type * from './query-builder/having-interface.js'
export type * from './query-builder/order-by-interface.js'
export * from './query-builder/select-query-builder.js'
export * from './query-builder/insert-query-builder.js'
export * from './query-builder/update-query-builder.js'
export * from './query-builder/delete-query-builder.js'
export * from './query-builder/no-result-error.js'
export * from './query-builder/join-builder.js'
export * from './query-builder/function-module.js'
export * from './query-builder/insert-result.js'
export * from './query-builder/delete-result.js'
export * from './query-builder/update-result.js'
export * from './query-builder/on-conflict-builder.js'
export * from './query-builder/aggregate-function-builder.js'
export * from './query-builder/case-builder.js'
export * from './query-builder/json-path-builder.js'
export * from './query-builder/merge-query-builder.js'
export * from './query-builder/merge-result.js'
export * from './query-builder/order-by-item-builder.js'

export * from './raw-builder/raw-builder.js'
export * from './raw-builder/sql.js'

export type * from './query-executor/query-executor.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/DefaultQueryExecutor.js'
export * from './query-executor/noop-query-executor.js'
export type * from './query-executor/query-executor-provider.js'

export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/default-query-compiler.js'
export * from './types/query-compiler/compiled-query.js'

export * from './schema/schema-module.js'
export * from './schema/create-table-builder.js'
export * from './schema/create-type-builder.js'
export * from './schema/drop-table-builder.js'
export * from './schema/drop-type-builder.js'
export * from './schema/create-index-builder.js'
export * from './schema/drop-index-builder.js'
export * from './schema/create-schema-builder.js'
export * from './schema/drop-schema-builder.js'
export * from './schema/column-definition-builder.js'
export * from './schema/foreign-key-constraint-builder.js'
export * from './schema/alter-table-builder.js'
export * from './schema/create-view-builder.js'
export * from './schema/refresh-materialized-view-builder.js'
export * from './schema/drop-view-builder.js'
export * from './schema/alter-column-builder.js'
export * from './schema/drop-column-builder.js'

export * from './dynamic/dynamic.js'
export * from './dynamic/dynamic-reference-builder.js'
export * from './dynamic/dynamic-table-builder.js'

export type * from './types/driver/driver.js'
export { TRANSACTION_ACCESS_MODES, TRANSACTION_ISOLATION_LEVELS, validateTransactionSettings } from './shared/driver/driver.js'
export type * from './types/driver/database-connection.js'
export type * from './types/driver/connection-provider.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/DefaultConnectionProvider.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/SingleConnectionProvider.js'
export * from './driver/dummy-driver.js'

export type * from './types/dialect/dialect.js'
export type * from './types/dialect/dialect-config.js'
export type * from './types/dialect/dialect-adapter.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/dialect-adapter-base.js'
export type * from './types/dialect/database-introspector.js'

export * from './dialect/sqlite/sqlite-dialect.js'
export type * from './types/dialect/sqlite-dialect-config.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/sqlite-driver.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/sqlite-query-compiler.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/sqlite-introspector.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/sqlite-adapter.js'

export * from './dialect/mysql/mysql-dialect.js'
export type * from './types/dialect/mysql-dialect-config.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mysql-driver.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/mysql-query-compiler.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mysql-introspector.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mysql-adapter.js'

export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/postgres-driver.js'
export type * from './types/dialect/postgres-dialect-config.js'
export * from './dialect/postgres/postgres-dialect.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/postgres-query-compiler.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/postgres-introspector.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/postgres-adapter.js'

export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mssql-adapter.js'
export type * from './types/dialect/mssql-dialect-config.js'
export * from './dialect/mssql/mssql-dialect.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mssql-driver.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/mssql-introspector.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/mssql-query-compiler.js'

export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/pglite-adapter.js'
export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyDriverComponent/pglite-driver.js'
export * from './dialect/pglite/pglite-dialect.js'
export type * from './types/dialect/pglite-dialect-config.js'

export * from './components/KyselyComponent/KyselyExecutorComponent/KyselyCompilerComponent/default-query-compiler.js'
export type * from './types/query-compiler/query-compiler.js'

export type * from './types/plugin/kysely-plugin.js'
export * from './plugin/camel-case/camel-case-plugin.js'
export * from './plugin/deduplicate-joins/deduplicate-joins-plugin.js'
export * from './plugin/with-schema/with-schema-plugin.js'
export * from './plugin/parse-json-results/parse-json-results-plugin.js'
export * from './plugin/handle-empty-in-lists/handle-empty-in-lists-plugin.js'
export * from './plugin/handle-empty-in-lists/handle-empty-in-lists.js'
export * from './plugin/safe-null-comparison/safe-null-comparison-plugin.js'

export * from './shared/operation-node/add-column-node.js'
export * from './shared/operation-node/add-constraint-node.js'
export * from './shared/operation-node/add-index-node.js'
export * from './shared/operation-node/aggregate-function-node.js'
export * from './shared/operation-node/alias-node.js'
export * from './shared/operation-node/alter-column-node.js'
export * from './shared/operation-node/alter-table-node.js'
export * from './shared/operation-node/and-node.js'
export * from './shared/operation-node/binary-operation-node.js'
export * from './shared/operation-node/case-node.js'
export * from './shared/operation-node/cast-node.js'
export * from './shared/operation-node/check-constraint-node.js'
export * from './shared/operation-node/collate-node.js'
export * from './shared/operation-node/column-definition-node.js'
export * from './shared/operation-node/column-node.js'
export * from './shared/operation-node/column-update-node.js'
export * from './shared/operation-node/common-table-expression-name-node.js'
export * from './shared/operation-node/common-table-expression-node.js'
export * from './shared/operation-node/constraint-node.js'
export * from './shared/operation-node/create-index-node.js'
export * from './shared/operation-node/create-schema-node.js'
export * from './shared/operation-node/create-table-node.js'
export * from './shared/operation-node/create-type-node.js'
export * from './shared/operation-node/create-view-node.js'
export * from './shared/operation-node/refresh-materialized-view-node.js'
export * from './shared/operation-node/data-type-node.js'
export * from './shared/operation-node/default-insert-value-node.js'
export * from './shared/operation-node/default-value-node.js'
export * from './shared/operation-node/delete-query-node.js'
export * from './shared/operation-node/drop-column-node.js'
export * from './shared/operation-node/drop-constraint-node.js'
export * from './shared/operation-node/drop-index-node.js'
export * from './shared/operation-node/drop-schema-node.js'
export * from './shared/operation-node/drop-table-node.js'
export * from './shared/operation-node/drop-type-node.js'
export * from './shared/operation-node/drop-view-node.js'
export * from './shared/operation-node/explain-node.js'
export * from './shared/operation-node/fetch-node.js'
export * from './shared/operation-node/foreign-key-constraint-node.js'
export * from './shared/operation-node/from-node.js'
export * from './shared/operation-node/function-node.js'
export * from './shared/operation-node/generated-node.js'
export * from './shared/operation-node/group-by-item-node.js'
export * from './shared/operation-node/group-by-node.js'
export * from './shared/operation-node/having-node.js'
export * from './shared/operation-node/identifier-node.js'
export * from './shared/operation-node/insert-query-node.js'
export * from './shared/operation-node/join-node.js'
export * from './shared/operation-node/json-operator-chain-node.js'
export * from './shared/operation-node/json-path-leg-node.js'
export * from './shared/operation-node/json-path-node.js'
export * from './shared/operation-node/json-reference-node.js'
export * from './shared/operation-node/limit-node.js'
export * from './shared/operation-node/list-node.js'
export * from './shared/operation-node/matched-node.js'
export * from './shared/operation-node/merge-query-node.js'
export * from './shared/operation-node/modify-column-node.js'
export * from './shared/operation-node/offset-node.js'
export * from './shared/operation-node/on-conflict-node.js'
export * from './shared/operation-node/on-duplicate-key-node.js'
export * from './shared/operation-node/on-node.js'
export * from './shared/operation-node/operation-node-source.js'
export * from './shared/operation-node/operation-node-transformer.js'
export * from './shared/operation-node/operation-node-visitor.js'
export type {
  OperationNode,
  OperationNodeKind,
} from './shared/operation-node/operation-node.js'
export * from './shared/operation-node/operator-node.js'
export * from './shared/operation-node/or-action-node.js'
export * from './shared/operation-node/or-node.js'
export * from './shared/operation-node/order-by-item-node.js'
export * from './shared/operation-node/order-by-node.js'
export * from './shared/operation-node/output-node.js'
export * from './shared/operation-node/over-node.js'
export * from './shared/operation-node/parens-node.js'
export * from './shared/operation-node/partition-by-item-node.js'
export * from './shared/operation-node/partition-by-node.js'
export * from './shared/operation-node/primary-key-constraint-node.js'
export * from './shared/operation-node/primitive-value-list-node.js'
export * from './shared/operation-node/query-node.js'
export * from './shared/operation-node/raw-node.js'
export * from './shared/operation-node/reference-node.js'
export * from './shared/operation-node/references-node.js'
export * from './shared/operation-node/rename-column-node.js'
export * from './shared/operation-node/rename-constraint-node.js'
export * from './shared/operation-node/returning-node.js'
export type { RootOperationNode } from './shared/operation-node/root-operation-node.js'
export * from './shared/operation-node/schemable-identifier-node.js'
export * from './shared/operation-node/select-all-node.js'
export * from './shared/operation-node/select-modifier-node.js'
export * from './shared/operation-node/select-query-node.js'
export * from './shared/operation-node/selection-node.js'
export * from './shared/operation-node/set-operation-node.js'
export * from './shared/operation-node/simple-reference-expression-node.js'
export * from './shared/operation-node/table-node.js'
export * from './shared/operation-node/top-node.js'
export * from './shared/operation-node/tuple-node.js'
export * from './shared/operation-node/unary-operation-node.js'
export * from './shared/operation-node/unique-constraint-node.js'
export * from './shared/operation-node/update-query-node.js'
export * from './shared/operation-node/using-node.js'
export * from './shared/operation-node/value-list-node.js'
export * from './shared/operation-node/value-node.js'
export * from './shared/operation-node/values-node.js'
export * from './shared/operation-node/when-node.js'
export * from './shared/operation-node/where-node.js'
export * from './shared/operation-node/with-node.js'
export * from './shared/operation-node/alter-type-node.js'
export * from './shared/operation-node/add-value-node.js'
export * from './shared/operation-node/rename-value-node.js'

export type * from './util/column-type.js'
export * from './util/compilable.js'
export type * from './util/explainable.js'
export type * from './util/streamable.js'
export type * from './util/executable.js'
export type * from './types/util/log.js'
export { Log, LOG_LEVELS } from './shared/util/log.js'
export type {
  AnyAliasedColumn,
  AnyAliasedColumnWithTable,
  AnyColumn,
  AnyColumnWithTable,
  DrainOuterGeneric,
  Equals,
  ExtractColumnType,
  NarrowPartial,
  NotNull,
  Nullable,
  NumbersWhenDataTypeNotAvailable,
  NumericString,
  ShallowDehydrateObject,
  ShallowDehydrateValue,
  Simplify,
  SimplifyDeep,
  SimplifyResult,
  SimplifySingleResult,
  SqlBool,
  StringsWhenDataTypeNotAvailable,
  UnknownRow,
} from './types/util/type-utils.js'
export type * from './util/infer-result.js'
export { logOnce } from './util/log-once.js'
export type { QueryId } from './types/util/query-id.js'
export { createQueryId } from './shared/util/query-id.js'
export type { KyselyTypeError } from './util/type-error.js'
export type {
  AbortableOperationOptions,
  AbortableQueryOptions,
  InflightQueryAbortStrategy,
} from './types/util/abort.js'

export type {
  SelectExpression,
  SelectCallback,
  SelectArg,
  Selection,
  CallbackSelection,
} from './shared/parser/select-parser.js'
export type {
  ReferenceExpression,
  ReferenceExpressionOrList,
  SimpleReferenceExpression,
  StringReference,
  ExtractTypeFromStringReference,
  ExtractTypeFromReferenceExpression,
} from './shared/parser/reference-parser.js'
export type {
  ValueExpression,
  ValueExpressionOrList,
} from './shared/parser/value-parser.js'
export type {
  SimpleTableReference,
  TableExpression,
  TableExpressionOrList,
} from './shared/parser/table-parser.js'
export type {
  JoinReferenceExpression,
  JoinCallbackExpression,
} from './shared/parser/join-parser.js'
export type { InsertObject } from './shared/parser/insert-values-parser.js'
export type { UpdateObject } from './shared/parser/update-set-parser.js'
export type {
  OrderByExpression,
  OrderByDirectionExpression,
  OrderByModifiers,
  OrderByDirection,
  OrderByModifiersCallbackExpression,
} from './shared/parser/order-by-parser.js'
export type {
  ComparisonOperatorExpression,
  OperandValueExpression,
  OperandValueExpressionOrList,
  FilterObject,
} from './shared/parser/binary-operation-parser.js'
export type { ExistsExpression } from './shared/parser/unary-operation-parser.js'
export type {
  OperandExpression,
  ExpressionOrFactory,
} from './shared/parser/expression-parser.js'
export type { Collation } from './shared/parser/collate-parser.js'
export type {
  CommonTableExpression,
  CommonTableExpressionOutput,
  CommonTableExpressionFactory,
  RecursiveCommonTableExpression,
  QueryCreatorWithCommonTableExpression,
} from './shared/parser/with-parser.js'

// deprecated exports

/**
 * @deprecated import from 'kysely/migration' instead.
 */
export declare const DEFAULT_ALLOW_UNORDERED_MIGRATIONS: KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export declare const DEFAULT_MIGRATION_LOCK_TABLE: KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export declare const DEFAULT_MIGRATION_TABLE: KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export declare const MIGRATION_LOCK_ID: KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type MigrateOptions =
  KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type Migration =
  KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type MigrationInfo =
  KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type MigrationProvider =
  KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type MigrationResult =
  KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type MigrationResultSet =
  KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export declare const Migrator: KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type MigratorProps =
  KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export declare const NO_MIGRATIONS: KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type NoMigrations =
  KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export declare const FileMigrationProvider: KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type FileMigrationProviderFS =
  KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type FileMigrationProviderPath =
  KyselyTypeError<"import from 'kysely/migration' instead">
/**
 * @deprecated import from 'kysely/migration' instead.
 */
export type FileMigrationProviderProps =
  KyselyTypeError<"import from 'kysely/migration' instead">
