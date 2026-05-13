import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { detectViolations } from "./enforce-arrow-function";

const FIXTURES_DIR = join(
  import.meta.dir,
  "fixtures",
  "enforce-arrow-function",
);

const loadFixtures = (subdir: "good" | "bad") => {
  const dir = join(FIXTURES_DIR, subdir);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => ({
      name: f,
      path: join(dir, f),
      source: readFileSync(join(dir, f), "utf-8"),
    }));
};

describe("enforce-arrow-function", () => {
  describe("good fixtures (no violations)", () => {
    for (const fixture of loadFixtures("good")) {
      test(fixture.name, () => {
        const violations = detectViolations(fixture.path, fixture.source);
        expect(violations).toEqual([]);
      });
    }
  });

  describe("bad fixtures (at least one violation)", () => {
    for (const fixture of loadFixtures("bad")) {
      test(fixture.name, () => {
        const violations = detectViolations(fixture.path, fixture.source);
        expect(violations.length).toBeGreaterThan(0);
      });
    }
  });
});
