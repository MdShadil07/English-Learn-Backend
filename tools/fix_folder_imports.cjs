const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'src');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith('.ts')) fixFile(full);
  }
}

function fixFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  let updated = src;

  const re = /(['"])(\.{1,2}\/[^'"\)]+?\.js)\1/g;
  updated = updated.replace(re, (m, q, pth) => {
    // if path points to a directory + .js (e.g., './Profile.js') and there's a directory with that name
    const noExt = pth.replace(/\.js$/, '');
    const dirPath = path.join(path.dirname(file), noExt);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      // prefer index.js in that folder
      const newP = noExt + '/index.js';
      return q + newP + q;
    }
    return m;
  });

  if (updated !== src) {
    fs.writeFileSync(file, updated, 'utf8');
    console.log('Fixed folder import in', path.relative(ROOT, file));
  }
}

console.log('Fixing folder-style imports under', ROOT);
walk(ROOT);
console.log('Done');
