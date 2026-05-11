#!/usr/bin/env bun

/**
 * harness/realtime.ts
 *
 * Audits Supabase `postgres_changes` realtime listeners against the
 * `supabase_realtime` PUBLICATION declared in the squashed migration.
 *
 * Silent-failure footgun: a listener like
 *
 *   supabase.channel(...).on("postgres_changes", { schema, table }, ...)
 *
 * will silently never fire if the target table isn't in
 * `ALTER PUBLICATION supabase_realtime ADD TABLE ...`. The Supabase client
 * doesn't surface an error — it just goes quiet. This rail makes the
 * coupling mechanical.
 *
 * Reports:
 *   - ERROR — listener targets a table NOT in the publication.
 *   - INFO  — publication declares a table no listener uses (probably fine,
 *             but worth knowing).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectFiles, locateLine, REPO_ROOT } from "./lib";

interface ListenerSite {
  line: number;
  relPath: string;
  schema: string;
  table: string;
}

async function findListenerCallsites(): Promise<ListenerSite[]> {
  const sites: ListenerSite[] = [];

  // Match `.on(...)` calls with `postgres_changes` as the first argument,
  // capturing the options object body up to the `},` boundary that
  // separates the options object from the callback. We use `},` (not a
  // bare `}`) because the options body can contain template literals like
  // `${variable}` whose closing brace would otherwise be matched first by
  // a non-greedy quantifier.
  //
  // Supabase's `postgres_changes` filter object is flat (event, schema,
  // table, filter — no nested objects), so the `},` terminator is
  // unambiguous as long as the callback is the third argument (which it
  // always is per the Supabase realtime API).
  const callsiteRegex =
    /\.on\s*(?:<[^>]*>)?\s*\(\s*["']postgres_changes["']\s*,\s*\{([\s\S]{0,800}?)\}\s*,/g;

  const files = await collectFiles([
    "apps/**/*.{ts,tsx}",
    "packages/**/*.{ts,tsx}",
  ]);

  for (const rel of files) {
    const source = readFileSync(resolve(REPO_ROOT, rel), "utf8");
    if (!source.includes("postgres_changes")) continue;

    callsiteRegex.lastIndex = 0;
    let m: RegExpExecArray | null = callsiteRegex.exec(source);
    while (m !== null) {
      const body = m[1];
      const schemaMatch = /\bschema\s*:\s*["']([a-zA-Z_][\w]*)["']/.exec(body);
      const tableMatch = /\btable\s*:\s*["']([a-zA-Z_][\w]*)["']/.exec(body);
      const line = locateLine(source, m.index);
      if (!tableMatch) {
        console.error(
          `harness/realtime: WARNING ${rel}:${line} — postgres_changes listener with no \`table:\` property; cannot audit`,
        );
      } else {
        sites.push({
          line,
          relPath: rel,
          schema: schemaMatch?.[1] ?? "public",
          table: tableMatch[1],
        });
      }
      m = callsiteRegex.exec(source);
    }
  }

  return sites;
}

async function findPublicationTables(): Promise<Set<string>> {
  const tables = new Set<string>();
  const files = await collectFiles([
    "supabase/migrations/*.sql",
  ]);
  for (const rel of files) {
    const source = readFileSync(resolve(REPO_ROOT, rel), "utf8");
    const pubRegex =
      /ALTER\s+PUBLICATION\s+"?supabase_realtime"?\s+ADD\s+TABLE\s+(?:ONLY\s+)?"?([a-zA-Z_][\w]*)"?\."?([a-zA-Z_][\w]*)"?/g;
    let m: RegExpExecArray | null = pubRegex.exec(source);
    while (m !== null) {
      tables.add(`${m[1]}.${m[2]}`);
      m = pubRegex.exec(source);
    }
  }
  return tables;
}

const listeners = await findListenerCallsites();
const published = await findPublicationTables();

const missing: ListenerSite[] = [];
const consumedTables = new Set<string>();
for (const site of listeners) {
  const fqtn = `${site.schema}.${site.table}`;
  consumedTables.add(fqtn);
  if (!published.has(fqtn)) {
    missing.push(site);
  }
}

const unusedPublications = [
  ...published,
].filter((t) => !consumedTables.has(t));

if (missing.length > 0) {
  console.error("");
  console.error("harness/realtime: listener / publication drift");
  console.error("");
  console.error(
    "  These `postgres_changes` listeners target tables NOT in the supabase_realtime publication.",
  );
  console.error(
    "  Without the publication, the listener will silently never fire.",
  );
  console.error("");
  for (const m of missing) {
    console.error(`    ${m.relPath}:${m.line} → ${m.schema}.${m.table}`);
  }
  console.error("");
  console.error(
    `  Action: add \`ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "${missing[0].schema}"."${missing[0].table}";\` to the squashed migration.`,
  );
  console.error("");
  process.exit(1);
}

if (unusedPublications.length > 0) {
  console.warn(
    "harness/realtime: tables in publication with no listener (info)",
  );
  for (const t of unusedPublications) {
    console.warn(`  ${t}`);
  }
  console.warn("");
}

console.log(
  `harness/realtime: OK (${listeners.length} listener${listeners.length === 1 ? "" : "s"}, ${published.size} table${published.size === 1 ? "" : "s"} in publication)`,
);
