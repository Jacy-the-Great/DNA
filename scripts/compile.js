#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUTS = path.join(ROOT, 'outputs');

function resolveImports(filePath, seen = new Set()) {
  const abs = path.resolve(filePath);

  if (seen.has(abs)) {
    console.warn(`Circular import skipped: ${abs}`);
    return '';
  }
  seen.add(abs);

  if (!fs.existsSync(abs)) {
    console.error(`Missing file: ${abs}`);
    process.exit(1);
  }

  const dir = path.dirname(abs);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const out = [];

  for (const line of lines) {
    const match = line.match(/^@(.+\.md)\s*$/);
    if (match) {
      const importPath = path.resolve(dir, match[1]);
      out.push(resolveImports(importPath, new Set(seen)));
    } else {
      out.push(line);
    }
  }

  return out.join('\n');
}

function compile(relPath) {
  const srcPath = path.resolve(ROOT, relPath);
  const name = path.basename(srcPath, '.md');
  const outPath = path.join(OUTPUTS, `${name}.compiled.md`);

  const result = resolveImports(srcPath);
  fs.writeFileSync(outPath, result, 'utf8');
  console.log(`Compiled: ${relPath} -> outputs/${name}.compiled.md`);
  return outPath;
}

// Discover all compilable source files (primaries + subs, not master itself)
function discoverTargets() {
  const targets = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
        targets.push(path.relative(ROOT, full).replace(/\\/g, '/'));
      }
    }
  }
  walk(path.join(ROOT, 'primaries'));
  walk(path.join(ROOT, 'subs'));
  return targets;
}

// Compile all discovered files if called with no args, or a specific file
const targets = process.argv.slice(2);
if (!fs.existsSync(OUTPUTS)) fs.mkdirSync(OUTPUTS);

if (targets.length === 0) {
  for (const t of discoverTargets()) compile(t);
} else {
  for (const t of targets) compile(t);
}
