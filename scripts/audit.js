#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EM_DASH = '—';

const SOURCES = [
  'master.md',
  'primaries/professional.md',
  'primaries/personal.md',
  'primaries/landiq.md',
  'subs/professional/brand-manager.md',
  'subs/personal/martini.md',
  'subs/personal/real-estate.md',
];

const EXPECTED_IMPORTS = {
  'primaries/professional.md':        ['master.md'],
  'primaries/personal.md':            ['master.md'],
  'primaries/landiq.md':              ['master.md'],
  'subs/professional/brand-manager.md': ['primaries/professional.md'],
  'subs/personal/martini.md':         ['primaries/personal.md'],
  'subs/personal/real-estate.md':     ['master.md'],
};

let passed = 0;
let failed = 0;

function ok(msg)   { console.log(`  PASS  ${msg}`); passed++; }
function fail(msg) { console.log(`  FAIL  ${msg}`); failed++; }

function check(label, condition, detail = '') {
  if (condition) ok(label);
  else fail(`${label}${detail ? ': ' + detail : ''}`);
}

// ── 1. All source files exist ─────────────────────────────────────────────────
console.log('\n[1] Source files exist');
for (const rel of SOURCES) {
  const abs = path.join(ROOT, rel);
  check(rel, fs.existsSync(abs));
}

// ── 2. No em dashes in any source file ───────────────────────────────────────
console.log('\n[2] No em dashes');
for (const rel of SOURCES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { fail(`${rel} (file missing)`); continue; }
  const content = fs.readFileSync(abs, 'utf8');
  const lines = content.split('\n');
  const hits = lines.reduce((acc, l, i) => l.includes(EM_DASH) ? acc.concat(i + 1) : acc, []);
  check(rel, hits.length === 0, hits.length ? `em dash on line(s) ${hits.join(', ')}` : '');
}

// ── 3. Import chains are correct ─────────────────────────────────────────────
console.log('\n[3] Import chains');
for (const [rel, expectedImports] of Object.entries(EXPECTED_IMPORTS)) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { fail(`${rel} (file missing)`); continue; }
  const dir = path.dirname(abs);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const imports = lines
    .filter(l => /^@.+\.md\s*$/.test(l))
    .map(l => path.relative(ROOT, path.resolve(dir, l.slice(1).trim())).replace(/\\/g, '/'));

  for (const expected of expectedImports) {
    check(`${rel} imports ${expected}`, imports.includes(expected),
      `found: [${imports.join(', ')}]`);
  }
}

// ── 4. No circular imports ────────────────────────────────────────────────────
console.log('\n[4] No circular imports');
function getImports(rel, seen = new Set()) {
  if (seen.has(rel)) return [rel]; // circular
  seen.add(rel);
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  const dir = path.dirname(abs);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const imports = lines
    .filter(l => /^@.+\.md\s*$/.test(l))
    .map(l => path.relative(ROOT, path.resolve(dir, l.slice(1).trim())).replace(/\\/g, '/'));
  for (const imp of imports) {
    const cycle = getImports(imp, new Set(seen));
    if (cycle.length) return [rel, ...cycle];
  }
  return [];
}
for (const rel of SOURCES) {
  const cycle = getImports(rel);
  check(rel, cycle.length === 0, cycle.length ? `cycle: ${cycle.join(' -> ')}` : '');
}

// ── 5. All imports resolve to real files ─────────────────────────────────────
console.log('\n[5] All imports resolve');
for (const rel of SOURCES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { fail(`${rel} (file missing)`); continue; }
  const dir = path.dirname(abs);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const imports = lines.filter(l => /^@.+\.md\s*$/.test(l)).map(l => l.slice(1).trim());
  if (imports.length === 0) { ok(`${rel} (no imports)`); continue; }
  for (const imp of imports) {
    const target = path.resolve(dir, imp);
    check(`${rel} -> ${imp}`, fs.existsSync(target));
  }
}

// ── 6. Compiled outputs exist and are newer than their sources ────────────────
console.log('\n[6] Compiled outputs up to date');
const COMPILE_MAP = {
  'primaries/professional.md':          'outputs/professional.compiled.md',
  'primaries/personal.md':              'outputs/personal.compiled.md',
  'primaries/landiq.md':                'outputs/landiq.compiled.md',
  'subs/professional/brand-manager.md': 'outputs/brand-manager.compiled.md',
  'subs/personal/martini.md':           'outputs/martini.compiled.md',
  'subs/personal/real-estate.md':       'outputs/real-estate.compiled.md',
};
for (const [src, out] of Object.entries(COMPILE_MAP)) {
  const srcAbs = path.join(ROOT, src);
  const outAbs = path.join(ROOT, out);
  if (!fs.existsSync(outAbs)) { fail(`${out} missing`); continue; }
  const srcMtime = fs.statSync(srcAbs).mtimeMs;
  const outMtime = fs.statSync(outAbs).mtimeMs;
  check(`${out}`, outMtime >= srcMtime, outMtime < srcMtime ? 'output older than source, recompile needed' : '');
}

// ── 7. martini.md has override block ─────────────────────────────────────────
console.log('\n[7] Martini override block present');
const martiniAbs = path.join(ROOT, 'subs/personal/martini.md');
if (fs.existsSync(martiniAbs)) {
  const content = fs.readFileSync(martiniAbs, 'utf8');
  check('TONE MIRROR OVERRIDE comment present', content.includes('TONE MIRROR OVERRIDE'));
  check('Override appears before @import', content.indexOf('TONE MIRROR OVERRIDE') < content.indexOf('@'));
}

// ── 8. real-estate.md does NOT import personal primary ───────────────────────
console.log('\n[8] real-estate.md skips personal primary');
const reAbs = path.join(ROOT, 'subs/personal/real-estate.md');
if (fs.existsSync(reAbs)) {
  const content = fs.readFileSync(reAbs, 'utf8');
  check('Does not import personal.md', !content.includes('personal.md'));
  check('Imports master.md directly', content.includes('@../../master.md'));
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
