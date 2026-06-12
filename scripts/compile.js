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

// Compile all source files if called with no args, or a specific file
const targets = process.argv.slice(2);

if (targets.length === 0) {
  const allTargets = [
    'primaries/professional.md',
    'primaries/personal.md',
    'primaries/landiq.md',
    'subs/professional/brand-manager.md',
    'subs/personal/martini.md',
    'subs/personal/real-estate.md',
  ];
  if (!fs.existsSync(OUTPUTS)) fs.mkdirSync(OUTPUTS);
  for (const t of allTargets) compile(t);
} else {
  if (!fs.existsSync(OUTPUTS)) fs.mkdirSync(OUTPUTS);
  for (const t of targets) compile(t);
}
