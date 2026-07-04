#!/usr/bin/env node
/**
 * Genera assistant/knowledge-base.json a partir de MDX y OpenAPI.
 * Ejecutar desde la raíz del repo: node assistant/scripts/build-knowledge-base.js
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const REPO_ROOT = path.join(__dirname, '..', '..');
const OUTPUT_PATH = path.join(__dirname, '..', 'knowledge-base.json');
const DOCS_BASE_URL = 'https://docs.tp.sima.ag';

const MDX_SKIP_DIRS = new Set(['.github', 'assistant', 'scripts', 'node_modules']);

function mdxPathToUrl(filePath) {
  const slug = filePath.replace(/\.mdx$/, '');
  return DOCS_BASE_URL + '/' + slug;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    return { meta: {}, body: content };
  }

  const meta = {};
  match[1].split('\n').forEach(function (line) {
    const kv = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
    if (kv) {
      meta[kv[1]] = kv[2];
    }
  });

  return { meta: meta, body: content.slice(match[0].length) };
}

function stripMdx(body) {
  let text = body;

  text = text.replace(/<CodeGroup>[\s\S]*?<\/CodeGroup>/g, function (block) {
    return block
      .replace(/<\/?CodeGroup>/g, '')
      .replace(/```[\w]*\n?/g, '\n')
      .replace(/```/g, '');
  });

  text = text.replace(/<[^>]+>[^<]*<\/[^>]+>/g, ' ');
  text = text.replace(/<[^>]+\/>/g, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  return text.trim();
}

function chunkMdx(filePath, content) {
  const relativePath = path.relative(REPO_ROOT, filePath);
  const parsed = parseFrontmatter(content);
  const pageTitle = parsed.meta.title || relativePath;
  const url = mdxPathToUrl(relativePath);
  const plain = stripMdx(parsed.body);
  const chunks = [];

  const sections = plain.split(/\n(?=## )/);

  sections.forEach(function (section, index) {
    const headingMatch = section.match(/^## (.+)/);
    const heading = headingMatch ? headingMatch[1].trim() : pageTitle;
    const body = headingMatch ? section.replace(/^## .+\n?/, '').trim() : section.trim();

    if (!body || body.length < 40) {
      return;
    }

    chunks.push({
      id: relativePath + '#' + index,
      source: relativePath,
      title: pageTitle,
      heading: heading,
      url: url + (index > 0 ? '#' + slugify(heading) : ''),
      content: body.slice(0, 4000),
    });
  });

  return chunks;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function collectMdxFiles(dir, files) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(function (entry) {
    if (MDX_SKIP_DIRS.has(entry.name)) {
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

function chunkOpenApi(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const spec = yaml.parse(raw);
  const chunks = [];
  const paths = spec.paths || {};

  Object.keys(paths).forEach(function (route) {
    const methods = paths[route];

    Object.keys(methods).forEach(function (method) {
      if (['get', 'post', 'put', 'patch', 'delete'].indexOf(method) === -1) {
        return;
      }

      const op = methods[method];
      const summary = op.summary || '';
      const description = (op.description || '').replace(/\s+/g, ' ').trim();
      const tags = (op.tags || []).join(', ');
      const content = [
        'Endpoint: ' + method.toUpperCase() + ' ' + route,
        summary ? 'Resumen: ' + summary : '',
        tags ? 'Tags: ' + tags : '',
        description ? 'Descripción: ' + description.slice(0, 1500) : '',
      ]
        .filter(Boolean)
        .join('\n');

      chunks.push({
        id: 'openapi:' + method + ':' + route,
        source: 'openapi.yaml',
        title: 'API Reference',
        heading: method.toUpperCase() + ' ' + route,
        url: DOCS_BASE_URL + '/api-reference/overview',
        content: content,
      });
    });
  });

  return chunks;
}

function main() {
  const mdxFiles = [];
  collectMdxFiles(REPO_ROOT, mdxFiles);

  let chunks = [];

  mdxFiles.forEach(function (filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    chunks = chunks.concat(chunkMdx(filePath, content));
  });

  const openApiPath = path.join(REPO_ROOT, 'openapi.yaml');
  if (fs.existsSync(openApiPath)) {
    chunks = chunks.concat(chunkOpenApi(openApiPath));
  }

  const output = {
    generatedAt: new Date().toISOString(),
    docsBaseUrl: DOCS_BASE_URL,
    chunkCount: chunks.length,
    chunks: chunks,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log('Knowledge base generada: ' + chunks.length + ' chunks → ' + OUTPUT_PATH);
}

main();
