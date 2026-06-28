# shared/driver

No-op `Driver` implementations used in compile-only and testing scenarios.

## What is here

- `dummy-driver.ts` — a `DummyDriver` that implements the `Driver` interface with stubs that throw at runtime, allowing query compilation without a live database connection.

## Why safe for `shared/`

Stateless: all methods are no-ops or unconditional throws. No injected dependencies, no external resource access, no mutable state.

## What is not here

The `Driver` interface and its associated types (`DatabaseConnection`, `DatabaseIntrospector`, `DialectAdapter`, etc.) live in `types/driver/`.
