#!/usr/bin/env node
/**
 * Static export build for GitHub Pages.
 *
 * Replaces API routes with stubs that return empty JSON, builds static output,
 * then restores the originals. Dynamic [param] routes are excluded entirely.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { dirname, basename, join } from "node:path";

const API_DIR = join(process.cwd(), "src", "app", "api");
const BACKUP_DIR = join(process.cwd(), ".static-export-backup");

const STUB = `import { NextResponse } from "next/server";
export const dynamic = "force-static";
export async function GET() { return NextResponse.json({}); }
export async function POST() { return NextResponse.json({}); }
`;

const routeFiles = execSync(`find "${API_DIR}" -name "route.ts"`, { encoding: "utf-8" })
  .trim()
  .split("\n")
  .filter(Boolean);

console.log(`Found ${routeFiles.length} API route files`);

const backedUp = [];
const renamedDirs = [];

try {
  // 1. Exclude dynamic param routes
  for (const filePath of routeFiles) {
    const dir = dirname(filePath);
    const dirName = basename(dir);
    if (dirName.startsWith("[") && dirName.endsWith("]")) {
      const hiddenDir = join(dirname(dir), `_skip_${dirName}`);
      renameSync(dir, hiddenDir);
      renamedDirs.push({ original: dir, hidden: hiddenDir });
      console.log(`  Excluding dynamic: ${dirName}`);
    }
  }

  // 1b. Preflight: reject any non-route file importing from a route file.
  //     Route stubs export no types, so such imports cause TS errors at build time.
  //     Rule: shared types must live in src/types/, never in src/app/api/*/route.ts.
  {
    const srcFiles = execSync(`find src -name "*.ts" -o -name "*.tsx"`, { encoding: "utf-8" })
      .trim().split("\n").filter(Boolean);
    const offenders = [];
    for (const f of srcFiles) {
      if (f.includes("/api/")) continue; // inter-route imports are fine
      const content = readFileSync(join(process.cwd(), f), "utf-8");
      const matches = content.match(/from ["'][^"']*app\/api\/[^"']*\/route["']/g) ?? [];
      for (const m of matches) offenders.push(`  ${f}: ${m}`);
    }
    if (offenders.length > 0) {
      console.error("\n❌ Static export preflight failed:");
      console.error("   Non-route files import from route files (stubs have no type exports).");
      console.error("   Move shared types to src/types/ before building:\n");
      offenders.forEach((o) => console.error(o));
      console.error();
      process.exit(1);
    }
    console.log("✓ Preflight: no component→route type imports found");
  }

  // 2. Re-scan and stub static routes
  const staticRoutes = execSync(`find "${API_DIR}" -name "route.ts"`, { encoding: "utf-8" })
    .trim()
    .split("\n")
    .filter(Boolean);

  mkdirSync(BACKUP_DIR, { recursive: true });

  for (const filePath of staticRoutes) {
    const relPath = filePath.replace(process.cwd() + "/", "");
    const backupPath = join(BACKUP_DIR, relPath);
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(backupPath, readFileSync(filePath, "utf-8"), "utf-8");
    writeFileSync(filePath, STUB, "utf-8");
    backedUp.push({ original: filePath, backup: backupPath });
  }
  console.log(`Stubbed ${backedUp.length} routes (originals backed up)`);

  // 3. Build
  execSync("next build --webpack", {
    stdio: "inherit",
    env: { ...process.env, NEXT_OUTPUT: "export" },
  });

  console.log("\nStatic export complete — output in ./out");
} finally {
  // 4. Restore everything
  for (const { original, backup } of backedUp) {
    writeFileSync(original, readFileSync(backup, "utf-8"), "utf-8");
  }
  console.log(`Restored ${backedUp.length} route files`);

  for (const { original, hidden } of renamedDirs) {
    if (existsSync(hidden)) renameSync(hidden, original);
  }
  if (renamedDirs.length) console.log(`Restored ${renamedDirs.length} dynamic routes`);

  // Clean up backup dir
  execSync(`rm -rf "${BACKUP_DIR}"`);
}
