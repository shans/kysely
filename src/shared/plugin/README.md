# shared/plugin

Built-in query plugin implementations — node transformers that pre-process query trees before compilation and post-process results after execution.

## What is here

Each subdirectory is a self-contained plugin:

- `camel-case/` — converts snake_case column names to camelCase and back
- `deduplicate-joins/` — removes duplicate join clauses from select/update/delete queries
- `handle-empty-in-lists/` — rewrites empty `IN ()` lists to always-false/always-true predicates
- `immediate-value/` — forces all values to be inlined as SQL literals rather than bound parameters
- `parse-json-results/` — recursively parses JSON strings in query results
- `safe-null-comparison/` — rewrites `= null` to `IS NULL` automatically
- `with-schema/` — prepends a schema name to all unqualified table references
- `noop-plugin.ts` — pass-through plugin used as a safe no-op default

## Why safe for `shared/`

Stateless: each plugin's behavior is fully determined by its constructor arguments and the query/result arguments passed to `transformQuery`/`transformResult`. No external resource reads, no mutable shared state across calls.

## What is not here

The `KyselyPlugin` interface, `PluginTransformQueryArgs`, and `PluginTransformResultArgs` types live in `types/plugin/`.
