// cleanup-duplicates.js
// Este script procura arquivos com o mesmo nome (excluindo node_modules) e, se o conteúdo for idêntico,
// remove cópias redundantes, mantendo apenas a primeira ocorrência encontrada.
// Uso: node scripts/cleanup-duplicates.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');

function walk(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    // Ignora node_modules e diretórios ocultos
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function main() {
  const allFiles = walk(projectRoot);
  // Map filename -> [{path,hash}]
  const map = {};
  for (const file of allFiles) {
    const name = path.basename(file);
    const fileHash = hashFile(file);
    if (!map[name]) map[name] = [];
    map[name].push({ path: file, hash: fileHash });
  }

  let removed = 0;
  for (const [name, entries] of Object.entries(map)) {
    if (entries.length < 2) continue; // não há duplicatas
    // agrupar por hash
    const byHash = {};
    for (const e of entries) {
      if (!byHash[e.hash]) byHash[e.hash] = [];
      byHash[e.hash].push(e.path);
    }
    for (const paths of Object.values(byHash)) {
      if (paths.length < 2) continue;
      // manter o primeiro, remover os demais
      const [keep, ...remove] = paths;
      for (const p of remove) {
        try {
          fs.unlinkSync(p);
          console.log(`Removed duplicate: ${p} (kept ${keep})`);
          removed++;
        } catch (err) {
          console.error(`Failed to remove ${p}:`, err.message);
        }
      }
    }
  }
  console.log(`Finished. Total duplicates removed: ${removed}`);
}

main();
