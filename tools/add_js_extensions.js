const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'src');
const extsToSkip = ['.js', '.ts', '.mjs', '.cjs', '.json'];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && full.endsWith('.ts')) {
      processFile(full);
    }
  }
}

function processFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  let updated = src;

  // Regex to find import/export paths: capture the quote and the path
  // Handles: import X from './foo'; export * from './bar'; await import('./baz')
  const re = /((?:from|import|export)\s*(?:\(|)?\s*)(['"])(\.\.?\/[^'"\)]+?)\2/g;

  updated = updated.replace(re, (match, p1, quote, pth) => {
    // If path already ends with a known extension, skip
    if (extsToSkip.some(e => pth.endsWith(e))) return match;
    // If path looks like a package import, skip (should start with ./ or ../)
    if (!pth.startsWith('./') && !pth.startsWith('../')) return match;
    // Append .js
    const newPath = pth + '.js';
    return `${p1}${quote}${newPath}${quote}`;
  });

  if (updated !== src) {
    fs.writeFileSync(file, updated, 'utf8');
    console.log('Updated:', path.relative(ROOT, file));
  }
}

console.log('Starting import extension codemod from', ROOT);
walk(ROOT);
console.log('Done.');
