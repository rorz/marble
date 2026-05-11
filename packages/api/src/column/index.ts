/**
 * packages/api/src/column/index.ts
 *
 * Import boundary for the column resource module. Other API code must
 * import `columnRouter` from here, never from `./actions` directly.
 * This keeps the actions module free to grow internal helpers, sub-
 * modules, or private state without leaking those to the rest of the
 * package.
 */

export { columnRouter } from "./actions";
