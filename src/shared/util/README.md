# shared/util

General-purpose runtime utilities used across the library.

## What is here

- `object-utils.ts` — freeze, type guards (`isObject`, `isFunction`, `isString`, …), and object helpers
- `compilable.ts` — `Compilable` interface + `isCompilable` runtime type-guard (kept together to avoid a split import for one trivial function)
- `deferred.ts` — `Deferred<T>` promise helper for controlled resolution/rejection
- `provide-controlled-connection.ts` — `provideControlledConnection` async helper + `ControlledConnection` interface (kept together for the same reason as `compilable.ts`)
- `log-once.ts` — `logOnce` helper that emits a console message at most once per message string (used for deprecation warnings)
- `json-object-args.ts` — extracts column-name/reference argument pairs from a select query node, used by the dialect-specific JSON helpers
- `random-string.ts` — generates short random hex strings (used for query IDs)
- `stack-trace-utils.ts` — `extendStackTrace` for attaching driver-level stack frames to errors
- `abort.ts` — abort/timeout signal helpers for cancellable queries
- `log.ts` — `Log` class wrapping user-supplied logger configuration
- `performance-now.ts` — `performanceNow` oracle (reads `performance.now()` or `Date.now()` depending on environment)
- `query-id.ts` — `createQueryId` factory (runtime counterpart to the `QueryId` type)

## Why safe for `shared/`

Stateless: each module's behaviour is determined entirely by its call arguments. The one exception (`log-once.ts`) maintains an in-process string cache as an optimisation to suppress duplicate deprecation warnings — this is a local, non-injectable side effect that does not affect query correctness.

`performance-now.ts` is an oracle: it reads the host clock but never writes to it, so callers cannot inject state through it.

## What is not here

Pure-type utilities — `ColumnType`, `Executable`, `Explainable`, `Streamable`, `KyselyTypeError`, `InferResult`, and the `Compilable` and `ControlledConnection` *interface declarations* — live in `types/util/` (the interface declarations in `compilable.ts` and `provide-controlled-connection.ts` are duplicated here only because splitting them from their companion runtime code would create an awkward two-file import for a single function).
