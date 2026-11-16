#!/usr/bin/env node
// ====================================================================
// Runs the pgTAP suite in supabase/tests/database against a real
// Postgres (a STAGING Supabase project — never production) without
// Docker or psql, which `supabase test db` needs.
//
//   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres \
//     node scripts/run-db-tests.mjs [file-filter]
//
// Every test file is wrapped in begin ... rollback, so fixtures never
// persist. 000_setup.sql is not: it installs pgTAP and the
// test_helpers.act_as() helper, which stay installed (harmless, and
// needed on every run).
//
// Exit code is non-zero if any assertion fails or any file errors.
// ====================================================================
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. Use the staging project's session-pooler connection string.");
  process.exit(2);
}
if (/prod/i.test(url)) {
  console.error("Refusing to run: the connection string looks like production.");
  process.exit(2);
}

const dir = path.join(process.cwd(), "supabase", "tests", "database");
const filter = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

let failed = 0;
let passed = 0;
let erroredFiles = 0;

for (const file of files) {
  const isSetup = file.startsWith("000_");
  if (filter && !isSetup && !file.includes(filter)) continue;

  // One connection per file so a failed transaction or role switch in
  // one file cannot leak into the next.
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
    const results = Array.isArray(result) ? result : [result];
    const lines = results
      .flatMap((r) => r.rows ?? [])
      .flatMap((row) => Object.values(row))
      .filter((v) => typeof v === "string")
      .flatMap((v) => v.split("\n"));

    const fileFailures = lines.filter((l) => /^not ok\b/.test(l));
    const filePasses = lines.filter((l) => /^ok\b/.test(l));
    const planLine = lines.find((l) => /^1\.\.\d+/.test(l));
    const planned = planLine ? Number(planLine.slice(3)) : null;
    const ran = fileFailures.length + filePasses.length;

    failed += fileFailures.length;
    passed += filePasses.length;

    if (isSetup) {
      console.log(`setup  ${file}`);
    } else if (fileFailures.length === 0 && (planned === null || planned === ran)) {
      console.log(`PASS   ${file} (${ran})`);
    } else {
      console.log(`FAIL   ${file} (${filePasses.length}/${planned ?? ran} passed)`);
      // Print each failure with pgTAP's diagnostic lines ("#   got/expected").
      lines.forEach((l, i) => {
        if (/^not ok\b/.test(l)) {
          console.log(`         ${l}`);
          for (let j = i + 1; j < lines.length && lines[j].startsWith("#"); j++) console.log(`         ${lines[j]}`);
        }
      });
      if (planned !== null && planned !== ran) {
        console.log(`         planned ${planned} but ran ${ran}`);
        failed += Math.max(0, planned - ran);
      }
    }
  } catch (err) {
    erroredFiles++;
    console.log(`ERROR  ${file}: ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${erroredFiles} file(s) errored`);
process.exit(failed > 0 || erroredFiles > 0 ? 1 : 0);
