const PROGRAM_CODE_PLACEHOLDER = "<program_code>";

const SERIALIZE_ERROR_HELPER = `
const serializeError = (err) => ({
  message: err?.message || String(err),
  name: err?.name,
  stack:
    typeof err?.stack === "string"
      ? err.stack.replace(
          /data:text\\/javascript;base64,[a-zA-Z0-9+/=]+/g,
          ${JSON.stringify(PROGRAM_CODE_PLACEHOLDER)},
        )
      : err?.stack,
  cause: err?.cause ? (err.cause.message || String(err.cause)) : undefined,
});
`.trim();

export const EXECUTOR_FILE_CONTENT = `
import { parseArgs } from "util";
import main from "../main.ts";

${SERIALIZE_ERROR_HELPER}

const { values: { inputAsBase64 } } = parseArgs({
  args: Bun.argv,
  options: {
    inputAsBase64: {
      type: "string"
    }
  },
  strict: true,
  allowPositionals: true,
});

const input = JSON.parse(atob(inputAsBase64));

try {
  const result = await main(input);
  console.log(JSON.stringify(result))
} catch (err) {
  console.error(JSON.stringify(serializeError(err)));
  process.exit(1);
}
`.trim();

export const BATCH_EXECUTOR_FILE_CONTENT = `
import { parseArgs } from "util";
import main from "../main.ts";

${SERIALIZE_ERROR_HELPER}

const { values: { jobsAsBase64 } } = parseArgs({
  args: Bun.argv,
  options: {
    jobsAsBase64: {
      type: "string"
    }
  },
  strict: true,
  allowPositionals: true,
});

const jobs = JSON.parse(atob(jobsAsBase64));
const results = [];

for (const job of jobs) {
  try {
    const value = await main(job.input);
    results.push({
      key: job.key,
      ok: true,
      value,
    });
  } catch (err) {
    results.push({
      key: job.key,
      ok: false,
      error: serializeError(err),
    });
  }
}

console.log(JSON.stringify({ results }));
`.trim();
