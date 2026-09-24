const fs = require('node:fs');
const path = require('node:path');

const indexPath = process.argv[2];
if (!indexPath) throw new Error('Missing bundled index.html path');

const html = fs.readFileSync(indexPath, 'utf8');
const moduleScript = /<script type="module" crossorigin src="(\.\/assets\/[^\"]+\.js)"><\/script>/g;
const matches = [...html.matchAll(moduleScript)];
if (matches.length !== 1) {
  throw new Error(`Expected one Vite entry script; found ${matches.length}`);
}

const bundledScript = fs.readFileSync(path.resolve(path.dirname(indexPath), matches[0][1]), 'utf8');
if (/\bimport\s*(?:\(|[\w*{])|\bexport\s+(?:default|const|function|class|\{)|import\.meta/.test(bundledScript)) {
  throw new Error('The web build contains ES module syntax and cannot be converted to a classic script');
}

const classicHtml = html
  .replace(moduleScript, '<script defer src="$1"></script>')
  .replace(/(<link rel="stylesheet") crossorigin(?= href="\.\/assets\/[^\"]+\.css")/g, '$1');

fs.writeFileSync(indexPath, classicHtml);
