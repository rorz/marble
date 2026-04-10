const PROGRAM_CODE_PLACEHOLDER = "<program_code>";

export const EXECUTOR_FILE_CONTENT = `
import { parseArgs } from "util";
import main from "../main.ts";

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
  const payload = {
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
  };
  console.error(JSON.stringify(payload));
  process.exit(1);
}
`.trim();
