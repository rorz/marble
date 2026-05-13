# enforce-arrow-function Fixtures

These fixtures are used to test the `enforce-arrow-function` harness rule.

## Layout

- `good/`: Files that MUST NOT trigger the rule.
  - `arrow.ts`: Standard arrow functions.
  - `generator.ts`: Generator functions (exempt).
  - `overload.ts`: TypeScript function overload groups (exempt).
  - `class-method.ts`: Class methods and getters (exempt).
  - `object-method.ts`: Object method shorthand (exempt).
  - `function-expression.ts`: Function expressions (handled by Biome).
  - `iife.ts`: Immediately Invoked Function Expressions.
  - `harness-ignored.ts`: Files with `// harness-ignore: enforce-arrow-function`.
  - `nested-arrow.ts`: Nested arrow functions.

- `bad/`: Files that MUST trigger the rule.
  - `simple.ts`: Plain function declaration.
  - `async.ts`: Async function declaration.
  - `export.ts`: Exported function declaration.
  - `default-export.ts`: Default exported named function declaration.
  - `default-export-anonymous.ts`: Default exported anonymous function declaration.
  - `generic.ts`: Generic function declaration.
  - `nested-generic.ts`: Generic function declaration with constraints.
  - `multiline-signature.ts`: Function declaration with multiline signature.
  - `async-generic.ts`: Async generic function declaration.
