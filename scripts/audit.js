#!/usr/bin/env node

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const EM_DASH  = '—';
const TODAY    = new Date();

let passed = 0;
let failed = 0;

function ok(msg)   { console.log(`  PASS  ${msg}`); passed++; }
function fail(msg) { console.log(`  FAIL  ${msg}`); failed++; }
function warn(msg) { console.log(`  WARN  ${msg}`); }

function check(label, condition, detail = '') {
  if (condition) ok(label);
  else fail(`${label}${detail ? ': ' + detail : ''}`);
}

// ── Dynamic source discovery ──────────────────────────────────────────────────
// Walks master.md + primaries/ + subs/**/ so new-sub.js additions are
// automatically included without touching this file.

function discoverSources() {
  const sources = [];

  const masterPath = path.join(ROOT, 'master.md');
  if (fs.existsSync(masterPath)) sources.push('master.md');

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
        sources.push(path.relative(ROOT, full).replace(/\\/g, '/'));
      }
    }
  }

  walk(path.join(ROOT, 'primaries'));
  walk(path.join(ROOT, 'subs'));
  return sources;
}

const SOURCES = discoverSources();

// Expected import for each source — explicit overrides take precedence,
// otherwise derived from directory location.
const IMPORT_OVERRIDES = {
  'subs/personal/real-estate.md': 'master.md',     // skips personal primary by design
};

function expectedImportFor(rel) {
  if (IMPORT_OVERRIDES[rel]) return IMPORT_OVERRIDES[rel];
  if (rel.startsWith('primaries/')) return 'master.md';
  if (rel.startsWith('subs/professional/')) return 'primaries/professional.md';
  if (rel.startsWith('subs/personal/'))     return 'primaries/personal.md';
  if (rel.startsWith('subs/landiq/'))       return 'primaries/landiq.md';
  return null; // master.md itself — no import expected
}

// ── Full import chain: max mtime across all transitive dependencies ───────────
function chainMaxMtime(rel, seen = new Set()) {
  const abs = path.join(ROOT, rel);
  if (seen.has(abs) || !fs.existsSync(abs)) return 0;
  seen.add(abs);

  let max = fs.statSync(abs).mtimeMs;
  const dir = path.dirname(abs);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const imports = lines
    .filter(l => /^@.+\.md\s*$/.test(l))
    .map(l => path.relative(ROOT, path.resolve(dir, l.slice(1).trim())).replace(/\\/g, '/'));

  for (const imp of imports) {
    max = Math.max(max, chainMaxMtime(imp, new Set(seen)));
  }
  return max;
}

// ── Circular import detection ─────────────────────────────────────────────────
function findCycle(rel, seen = new Set()) {
  if (seen.has(rel)) return [rel];
  seen.add(rel);
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  const dir = path.dirname(abs);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const imports = lines
    .filter(l => /^@.+\.md\s*$/.test(l))
    .map(l => path.relative(ROOT, path.resolve(dir, l.slice(1).trim())).replace(/\\/g, '/'));
  for (const imp of imports) {
    const cycle = findCycle(imp, new Set(seen));
    if (cycle.length) return [rel, ...cycle];
  }
  return [];
}

// ── Compiled output path for a source file ────────────────────────────────────
function compiledOutputFor(rel) {
  const name = path.basename(rel, '.md');
  return `outputs/${name}.compiled.md`;
}

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\nDiscovered ${SOURCES.length} source files\n`);

// ── 1. All source files exist ─────────────────────────────────────────────────
console.log('[1] Source files exist');
for (const rel of SOURCES) {
  check(rel, fs.existsSync(path.join(ROOT, rel)));
}

// ── 2. No em dashes ──────────────────────────────────────────────────────────
console.log('\n[2] No em dashes');
for (const rel of SOURCES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { fail(`${rel} (missing)`); continue; }
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const hits = lines.flatMap((l, i) => l.includes(EM_DASH) ? [i + 1] : []);
  check(rel, hits.length === 0, hits.length ? `em dash on line(s) ${hits.join(', ')}` : '');
}

// ── 3. Import chains correct ──────────────────────────────────────────────────
console.log('\n[3] Import chains');
for (const rel of SOURCES) {
  const expected = expectedImportFor(rel);
  if (!expected) { ok(`${rel} (root — no import expected)`); continue; }

  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { fail(`${rel} (missing)`); continue; }
  const dir = path.dirname(abs);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const imports = lines
    .filter(l => /^@.+\.md\s*$/.test(l))
    .map(l => path.relative(ROOT, path.resolve(dir, l.slice(1).trim())).replace(/\\/g, '/'));

  check(
    `${rel} imports ${expected}`,
    imports.includes(expected),
    imports.length ? `found: [${imports.join(', ')}]` : 'no @import lines found'
  );
}

// ── 4. No circular imports ────────────────────────────────────────────────────
console.log('\n[4] No circular imports');
for (const rel of SOURCES) {
  const cycle = findCycle(rel);
  check(rel, cycle.length === 0, cycle.length ? `cycle: ${cycle.join(' -> ')}` : '');
}

// ── 5. All imports resolve ────────────────────────────────────────────────────
console.log('\n[5] All imports resolve');
for (const rel of SOURCES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { fail(`${rel} (missing)`); continue; }
  const dir = path.dirname(abs);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const imports = lines.filter(l => /^@.+\.md\s*$/.test(l)).map(l => l.slice(1).trim());
  if (imports.length === 0) { ok(`${rel} (no imports)`); continue; }
  for (const imp of imports) {
    check(`${rel} -> ${imp}`, fs.existsSync(path.resolve(dir, imp)));
  }
}

// ── 6. Compiled outputs up to date (full import chain) ───────────────────────
// Compares the compiled output mtime against the most-recently-modified file
// anywhere in the full transitive import chain — catches edits to master.md
// that would otherwise silently leave compiled outputs stale.
console.log('\n[6] Compiled outputs up to date (full chain)');
for (const rel of SOURCES) {
  if (rel === 'master.md') continue; // master is not compiled directly
  const outRel = compiledOutputFor(rel);
  const outAbs = path.join(ROOT, outRel);
  if (!fs.existsSync(outAbs)) { fail(`${outRel} missing`); continue; }

  const maxChainMtime = chainMaxMtime(rel);
  const outMtime      = fs.statSync(outAbs).mtimeMs;
  check(
    outRel,
    outMtime >= maxChainMtime,
    outMtime < maxChainMtime ? 'stale — a dependency was edited after last compile' : ''
  );
}

// ── 7. master.md has all mandatory sections ───────────────────────────────────
console.log('\n[7] master.md mandatory sections');
const masterContent = fs.readFileSync(path.join(ROOT, 'master.md'), 'utf8');
const REQUIRED_SECTIONS = [
  { label: 'Identity',           pattern: /^## Identity/m },
  { label: '90-Day Thrive Priorities', pattern: /^## 90-Day Thrive Priorities/m },
  { label: 'Behaviour Rules',    pattern: /^## Behaviour Rules/m },
  { label: 'Tone Mirror',        pattern: /^### Tone Mirror/m },
  { label: 'Precedence rule',    pattern: /Precedence rule/i },
];
for (const { label, pattern } of REQUIRED_SECTIONS) {
  check(label, pattern.test(masterContent));
}

// ── 8. Thrive priorities review date ─────────────────────────────────────────
console.log('\n[8] Thrive priorities review date');
const dateMatch = masterContent.match(/Next review:\s*(\d{1,2}\s+\w+\s+\d{4})/);
if (!dateMatch) {
  fail('No review date found in master.md');
} else {
  const reviewDate = new Date(dateMatch[1]);
  const isPast     = TODAY > reviewDate;
  const label      = `Review date: ${dateMatch[1]}`;
  if (isPast) fail(`${label} — OVERDUE`);
  else ok(`${label} — not yet due`);
}

// ── 9. Martini override block ─────────────────────────────────────────────────
console.log('\n[9] Martini override block');
const martiniAbs = path.join(ROOT, 'subs/personal/martini.md');
if (fs.existsSync(martiniAbs)) {
  const c = fs.readFileSync(martiniAbs, 'utf8');
  check('TONE MIRROR OVERRIDE comment present', c.includes('TONE MIRROR OVERRIDE'));
  check('Override appears before @import',
    c.indexOf('TONE MIRROR OVERRIDE') < c.indexOf('@'));
}

// ── 10. real-estate.md skips personal primary ────────────────────────────────
console.log('\n[10] real-estate.md skips personal primary');
const reAbs = path.join(ROOT, 'subs/personal/real-estate.md');
if (fs.existsSync(reAbs)) {
  const c = fs.readFileSync(reAbs, 'utf8');
  check('Does not import personal.md', !c.includes('personal.md'));
  check('Imports master.md directly',   c.includes('@../../master.md'));
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log('\n  Note: duplicate facts across layers not checked (v2 improvement)');
if (failed > 0) process.exit(1);
