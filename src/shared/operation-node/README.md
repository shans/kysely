# shared/operation-node

AST node definitions for the SQL query IR (intermediate representation).

## Contents

Each file exports two things with the same name (TypeScript declaration merging):

- An **`interface`** — the plain data shape of the node (e.g. `SelectQueryNode`)
- A **`const`** factory object — stateless methods for constructing and cloning nodes
  (e.g. `SelectQueryNode.create(...)`, `SelectQueryNode.cloneWithSelections(...)`)

## Why this directory is safe to share

All factory objects are **stateless**: they take plain node data as arguments and return
new frozen node objects. No factory holds mutable state, accepts callbacks, or closes over
any component's context. A caller cannot inject state through a factory that another caller
would later observe, so these files cannot be used to leak data between components.

## Companion types

The `interface` half of each file is a companion type to its factory. Because the two
declarations are tightly coupled (same name, same file), they travel together rather than
being split across `types/` and `shared/`. Importers that need only the type should use
`import type { ... }` from this location.
