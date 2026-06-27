# shared/parser

Input parsers: functions that accept user-facing API arguments (strings, callbacks,
expression builders) and produce plain operation-node trees.

## Why this directory is safe to share

All parsers are **stateless**: each function takes its inputs, calls operation-node
factories, and returns a new plain node (or a type). No parser holds mutable state,
accepts a callback that closes over a component's context, or stores anything between
calls. A caller cannot inject state through a parser that another caller would later
observe.

## Companion types

Many parser files export both type aliases (e.g. `SelectExpression<DB, TB>`) and
runtime functions (e.g. `parseSelectArg`). Because the types are tightly coupled to
the functions they parameterise, they travel together rather than being split across
`types/` and `shared/`. Importers that need only the type should use `import type`
from this location.
