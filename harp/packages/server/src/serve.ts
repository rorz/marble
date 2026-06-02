import { join } from "node:path";
import { createFileStore, createHarpServer } from "./index";

const dataDir = process.env.HARP_DATA_DIR ?? join(process.cwd(), ".harp-data");
const port = Number(process.env.HARP_PORT ?? 4277);

const store = createFileStore(dataDir);
const app = createHarpServer({
  store,
});

Bun.serve({
  fetch: app.fetch,
  port,
});

console.log(`HARP \uD83E\uDE89 listening on http://localhost:${port}`);
console.log(`   data dir: ${dataDir}`);
console.log(`   docs:     http://localhost:${port}/openapi`);
