# codeView/query-builder

Query builder CodeViews: classes that wrap a plain operation-node tree and expose a
fluent API for constructing SQL queries (SELECT, INSERT, UPDATE, DELETE, MERGE).

Each builder holds only its query node as props — no injected executor, compiler, or
database connection. Terminal methods (`.execute()`, `.compile()`, `.stream()`) are
declared on the exported interface but are not implemented here; they are filled in by
the API wrapper (`api.ts`) via `wrapBuilder`. This keeps the builders pure: constructable
from plain data, holding no mutable state, closing over no component's context.

## Directory contents

- **Main builders**: `select-query-builder.ts`, `insert-query-builder.ts`,
  `delete-query-builder.ts`, `update-query-builder.ts`, `merge-query-builder.ts`
- **Sub-builders**: `join-builder.ts`, `on-conflict-builder.ts`, `over-builder.ts`,
  `order-by-item-builder.ts`, `aggregate-function-builder.ts`, `case-builder.ts`,
  `cte-builder.ts`, `json-path-builder.ts`
- **Shared interfaces** (exclusive private helpers — not imported outside this directory):
  `having-interface.ts`, `where-interface.ts`, `returning-interface.ts`,
  `output-interface.ts`, `order-by-interface.ts`, `select-query-builder-expression.ts`
- **Result types**: `insert-result.ts`, `update-result.ts`, `delete-result.ts`,
  `merge-result.ts` — plain data wrappers returned by terminal operations
- **Error**: `no-result-error.ts` — thrown by `.executeTakeFirstOrThrow()`
- **Function module**: `function-module.ts` — SQL aggregate/window function builders
