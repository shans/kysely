# shared/query-executor

Core query execution infrastructure — the pipeline that runs plugins, streams results, and dispatches compiled queries to the driver.

## What is here

- `query-executor-base.ts` — abstract base class implementing the plugin transform pipeline, streaming, and connection management that all concrete executors share.
- `noop-query-executor.ts` — a `NoopQueryExecutor` (+ `NOOP_QUERY_EXECUTOR` singleton) that throws on any attempt to execute, used as the default executor inside CodeView builders where no driver is present.

## Why safe for `shared/`

Stateless: the executor holds only its plugin list (injected at construction from plain data) and delegates all I/O to the driver passed at call time. No mutable shared state, no direct external resource access.

## What is not here

The `QueryExecutor` interface and `QueryExecutorProvider` interface live in `types/query-executor/`.
