// Platformdan bağımsız: next standalone için statik + public kopyala (cp -r yerine).
// fs.cpSync bazı node sürümlerinde Windows'ta çöküyor → manuel özyinelemeli kopya.
import fs from 'node:fs';
import path from 'node:path';

function copyDir(src, dest) {
  if (!fs.existsSync(src)) { console.warn('[copy-assets] atlandi (yok):', src); return; }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

copyDir('.next/static', '.next/standalone/.next/static');
copyDir('public', '.next/standalone/public');
console.log('[copy-assets] static + public -> .next/standalone kopyalandi');
