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

const PARSE_BASE64_JSON_HELPER = `
const parseBase64Json = (value) => {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};
`.trim();

export const EXECUTOR_FILE_CONTENT = `
import main from "../main.ts";

${SERIALIZE_ERROR_HELPER}
${PARSE_BASE64_JSON_HELPER}

const inputAsBase64 = process.env.MARBLE_INPUT_B64;
if (!inputAsBase64) {
  throw new Error("MARBLE_INPUT_B64 is not set");
}

const input = parseBase64Json(inputAsBase64);

try {
  const result = await main(input);
  console.log(JSON.stringify(result))
} catch (err) {
  console.error(JSON.stringify(serializeError(err)));
  process.exit(1);
}
`.trim();

export const BATCH_EXECUTOR_FILE_CONTENT = `
import main from "../main.ts";

${SERIALIZE_ERROR_HELPER}
${PARSE_BASE64_JSON_HELPER}

const jobsAsBase64 = process.env.MARBLE_JOBS_B64;
if (!jobsAsBase64) {
  throw new Error("MARBLE_JOBS_B64 is not set");
}

const jobs = parseBase64Json(jobsAsBase64);
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
