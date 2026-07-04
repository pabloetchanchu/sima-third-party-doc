#!/usr/bin/env node
/**
 * Agrega el snippet del asistente a todas las páginas MDX.
 * node scripts/inject-assistant-snippet.js
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const IMPORT_LINE = 'import { SimaAssistant } from "/snippets/SimaAssistant.jsx";';
const MARKER = '<SimaAssistant />';
const SKIP_DIRS = new Set(['.github', 'assistant', 'scripts', 'node_modules', 'snippets']);

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

function injectAssistant(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  if (content.indexOf(MARKER) !== -1) {
    return false;
  }

  const frontmatterMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!frontmatterMatch) {
    console.warn('Sin frontmatter, omitido: ' + filePath);
    return false;
  }

  const afterFrontmatter = content.slice(frontmatterMatch[0].length);
  const updated = frontmatterMatch[0] + IMPORT_LINE + '\n\n' + afterFrontmatter.trimEnd() + '\n\n' + MARKER + '\n';
  fs.writeFileSync(filePath, updated);
  return true;
}

function main() {
  const files = [];
  collectMdxFiles(REPO_ROOT, files);

  var updated = 0;
  files.forEach(function (filePath) {
    if (injectAssistant(filePath)) {
      updated += 1;
      console.log('Actualizado: ' + path.relative(REPO_ROOT, filePath));
    }
  });

  console.log('Listo: ' + updated + ' archivos actualizados.');
}

main();
