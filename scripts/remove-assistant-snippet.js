#!/usr/bin/env node
/**
 * Quita el snippet del asistente de todas las páginas MDX.
 * node scripts/remove-assistant-snippet.js
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const IMPORT_LINE = 'import { SimaAssistant } from "/snippets/SimaAssistant.jsx";';
const MARKER = '<SimaAssistant />';
const SKIP_DIRS = new Set(['.github', 'assistant', 'scripts', 'node_modules', 'snippets', 'assets']);

function collectMdxFiles(dir, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(function (entry) {
    if (SKIP_DIRS.has(entry.name)) {
      return;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectMdxFiles(fullPath, files);
      return;
    }

    if (entry.name.endsWith('.mdx')) {
      files.push(fullPath);
    }
  });
}

function removeAssistant(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  content = content.replace(IMPORT_LINE + '\n\n', '');
  content = content.replace(IMPORT_LINE + '\n', '');
  content = content.replace('\n\n' + MARKER + '\n', '\n');
  content = content.replace('\n' + MARKER + '\n', '\n');
  content = content.replace(MARKER, '');

  if (content === original) {
    return false;
  }

  fs.writeFileSync(filePath, content);
  return true;
}

function main() {
  const files = [];
  collectMdxFiles(REPO_ROOT, files);

  var updated = 0;
  files.forEach(function (filePath) {
    if (removeAssistant(filePath)) {
      updated += 1;
      console.log('Limpiado: ' + path.relative(REPO_ROOT, filePath));
    }
  });

  console.log('Listo: ' + updated + ' archivos actualizados.');
}

main();
