#!/usr/bin/env node
// Ratchet for the UI guideline "no new hex literals": a file may only reduce its
// count. Existing debt is burned down when a screen is touched, not mass-rewritten.
//   node scripts/check-ui-tokens.mjs            fail if any file exceeds its baseline
//   node scripts/check-ui-tokens.mjs --update   record current counts as the baseline
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = ['apps/web/app', 'apps/web/src', 'apps/web/components'];
const BASELINE_PATH = join(ROOT, 'apps/web/ui-token-baseline.json');
const HEX_LITERAL = /#[0-9a-fA-F]{6}\b/g;

function tsxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

const counts = {};
for (const dir of SCAN_DIRS) {
  for (const file of tsxFiles(join(ROOT, dir))) {
    const count = readFileSync(file, 'utf8').match(HEX_LITERAL)?.length ?? 0;
    if (count > 0) counts[relative(ROOT, file).split(sep).join('/')] = count;
  }
}

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Baseline updated: ${Object.keys(sorted).length} files.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const regressions = Object.entries(counts).filter(([file, count]) => count > (baseline[file] ?? 0));

if (regressions.length > 0) {
  console.error('New hex literals found. Use semantic tokens (docs/architecture/ui-ux-performance-guidelines.md):');
  for (const [file, count] of regressions) {
    console.error(`  ${file}: ${count} (baseline ${baseline[file] ?? 0})`);
  }
  process.exit(1);
}

const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
console.log(`UI tokens OK: ${total} hex literals in ${Object.keys(counts).length} files, none above baseline.`);
