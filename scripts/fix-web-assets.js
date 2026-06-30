// Vercel silently excludes any path containing "node_modules" from static
// deployments, even when those files are committed to git. Expo's web export
// mirrors require() resolution paths under dist/assets/, which puts font and
// icon files from @expo-google-fonts/* and @expo/vector-icons under
// dist/assets/node_modules/... — so they 404 in production despite being
// present in the build output and the git repo.
//
// This script moves those files to dist/assets/vendor/ and rewrites the
// matching references in the compiled JS bundle(s) so the app requests the
// new path instead.
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const SRC = path.join(DIST, 'assets', 'node_modules');
const DEST = path.join(DIST, 'assets', 'vendor');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.renameSync(srcPath, destPath);
    }
  }
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

if (!fs.existsSync(SRC)) {
  console.log('[fix-web-assets] no dist/assets/node_modules found, nothing to do');
  process.exit(0);
}

copyRecursive(SRC, DEST);
removeEmptyDirs(SRC);
console.log('[fix-web-assets] moved dist/assets/node_modules -> dist/assets/vendor');

const jsDir = path.join(DIST, '_expo', 'static', 'js', 'web');
let rewritten = 0;
for (const file of fs.readdirSync(jsDir)) {
  if (!file.endsWith('.js')) continue;
  const filePath = path.join(jsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('assets/node_modules/')) continue;
  const updated = content.split('assets/node_modules/').join('assets/vendor/');
  fs.writeFileSync(filePath, updated);
  rewritten++;
  console.log(`[fix-web-assets] rewrote references in ${file}`);
}
if (rewritten === 0) {
  console.log('[fix-web-assets] no JS bundle referenced assets/node_modules/');
}
