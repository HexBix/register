const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getChangedDomainFilesFromPush(beforeSha, afterSha) {
  const diffCmd = `git diff --name-status ${beforeSha} ${afterSha}`;
  const out = execSync(diffCmd).toString().trim();
  if (!out) return [];
  const lines = out.split('\n');
  const files = [];
  for (const line of lines) {
    const [status, filePath] = line.split('\t');
    if (!filePath) continue;
    if (!filePath.startsWith('domains/') || !filePath.endsWith('.json')) continue;
    files.push({ status, filePath });
  }
  return files;
}

function extractName(filePath) {
  const base = path.basename(filePath);
  const parts = base.split('.');
  if (parts.length < 4) return null;
  return parts[0];
}

function readListFile(listPath) {
  if (!fs.existsSync(listPath)) return {};
  const lines = fs.readFileSync(listPath, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  const map = {};
  for (const line of lines) {
    const m = line.match(/^([^:]+):\s*"([^"]+)"$/);
    if (m) {
      map[m[1]] = m[2];
    }
  }
  return map;
}

function writeListFile(listPath, map) {
  const entries = Object.keys(map).sort().map(name => `${name}: "${map[name]}"`);
  fs.writeFileSync(listPath, entries.join('\n') + (entries.length ? '\n' : ''), 'utf8');
}

try {
  const before = process.env.BEFORE_SHA;
  const after = process.env.AFTER_SHA;
  if (!before || !after) {
    console.log('Missing BEFORE_SHA/AFTER_SHA, skipping lists update.');
    process.exit(0);
  }

  const changed = getChangedDomainFilesFromPush(before, after);
  if (changed.length === 0) {
    console.log('No domain JSON changes detected on push. Skipping lists.txt update.');
    process.exit(0);
  }

  const listPath = path.join(process.cwd(), 'lists.txt');
  const map = readListFile(listPath);

  let modified = false;
  for (const { status, filePath } of changed) {
    const name = extractName(filePath);
    if (!name) continue;
    if (status === 'A' || status === 'M') {
      if (map[name] !== 'active') {
        map[name] = 'active';
        modified = true;
      }
    }
  }

  if (modified) {
    writeListFile(listPath, map);
    console.log('lists.txt updated to active.');
  } else {
    console.log('lists.txt not changed.');
  }
} catch (e) {
  console.error('Failed updating lists.txt (main):', e.message);
  process.exit(1);
}

