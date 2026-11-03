#!/usr/bin/env node
/* 由 index.html 生成 legacy.html：
 *   - JS 降到 ES2015（Safari 10 / iOS 10.3+ 可解析）
 *   - 前置 legacy-polyfill.js：Pointer Events、ResizeObserver 兜底
 * 用法: node scripts/make-legacy.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
process.chdir(root);

const html = readFileSync('index.html', 'utf8');
const block = html.match(/<script>([\s\S]*?)<\/script>/);
if (!block) throw new Error('index.html 里找不到 <script> 块');

const src = join(tmpdir(), 'orbit-legacy-src.js');
const out = join(tmpdir(), 'orbit-legacy-built.js');
const debugTail = `
if (/(^|[?&])debug(=|&|$)/.test(location.search)) {
  window.__orbit = { S: S, el: el, paint: paint, layout: layout, setUI: setUI, headingOf: headingOf };
}`;
writeFileSync(src, block[1] + debugTail);

const runner = process.env.ESBUILD || 'bunx';
execFileSync(runner, [
  'esbuild', src,
  '--target=es2015',
  '--format=iife',
  '--minify',
  `--outfile=${out}`,
], { stdio: 'inherit' });

const built = readFileSync(out, 'utf8');
const polyfill = readFileSync(join(here, 'legacy-polyfill.js'), 'utf8');
const orbSource = readFileSync(join(root, 'sdk/js/orb.js'), 'utf8');

const legacy = html
  .replace(block[0], `<script>\n${polyfill}\n${built}\n</script>`)
  .replace('<script src="sdk/js/orb.js"></script>', () => `<script>\n${orbSource}\n</script>`)
  .replace('<html lang="zh-CN">', '<html lang="zh-CN" data-legacy="1">')
  .replace('<title>', '<title>兼容版 · ');

writeFileSync('legacy.html', legacy);
console.log(`已生成 legacy.html（${(legacy.length / 1024).toFixed(1)} KB，JS ${(built.length / 1024).toFixed(1)} KB）`);
