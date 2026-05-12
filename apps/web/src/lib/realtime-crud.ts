/**
 * Domain-named re-exports of `@marble/lib` primitives used by realtime
 * CRUD helpers in the web app. Each name maps 1:1 onto a lib primitive;
 * keeping the old import shape avoids churning every caller site.
 */

export {
  removeById as removeRow,
  sortBy as sortRows,
  upsertById as upsertRow,
} from "@marble/lib/array";
import { byDateDesc } from "@marble/lib/compare";

export { getErrorMessage } from "@marble/lib/result";

export const compareByCreatedAtCamelDesc = byDateDesc<{
  createdAt: string;
}>((row) => row.createdAt);

export const compareByUpdatedAtCamelDesc = byDateDesc<{
  updatedAt: string;
}>((row) => row.updatedAt);
