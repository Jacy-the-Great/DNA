#!/usr/bin/env node
// Usage: node scripts/new-sub.js <primary> <sub-name>
// Example: node scripts/new-sub.js landiq training-modules

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PRIMARIES = ['professional', 'personal', 'landiq'];

const IMPORT_MAP = {
  professional: '../../primaries/professional.md',
  personal:     '../../primaries/personal.md',
  landiq:       '../../primaries/landiq.md',
};

const [primary, name] = process.argv.slice(2);

if (!primary || !name) {
  console.error('Usage: node scripts/new-sub.js <primary> <sub-name>');
  console.error(`Primaries: ${PRIMARIES.join(', ')}`);
  process.exit(1);
}

if (!PRIMARIES.includes(primary)) {
  console.error(`Unknown primary "${primary}". Choose from: ${PRIMARIES.join(', ')}`);
  process.exit(1);
}

const dir  = path.join(ROOT, 'subs', primary);
const file = path.join(dir, `${name}.md`);

if (fs.existsSync(file)) {
  console.error(`Already exists: subs/${primary}/${name}.md`);
  process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });

const importPath = IMPORT_MAP[primary];
const title = name
  .split('-')
  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

const scaffold = `@${importPath}

# ${title}

Scaffold. Add ${primary}-specific context here.
`;

fs.writeFileSync(file, scaffold, 'utf8');
console.log(`Created:  subs/${primary}/${name}.md`);
console.log(`Chain:    ${name}.md -> ${primary}.md -> master.md`);
console.log(`Next:     run "node scripts/compile.js subs/${primary}/${name}.md" to compile`);
