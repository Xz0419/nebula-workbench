#!/usr/bin/env node
// 把 pnpm 的 .pnpm 虚拟存储"提升"（hoist）到顶层 node_modules。
//
// 背景：本机没有创建真符号链接的权限（无开发者模式/管理员），只能用 junction；
// 而 Node 的 ESM 解析器在 Windows 上不会把 junction realpath 掉，
// 于是 node_modules/vite（junction）里的 `import 'esbuild'` 会从
// node_modules/vite/... 一路向上找，最终落到顶层 node_modules，
// 里面却没有 esbuild —— 报 ERR_MODULE_NOT_FOUND。
//
// 解决：把 .pnpm/<pkg>/node_modules 下的每个包都在顶层 node_modules 里补一个
// junction。这样任何深度的裸模块查找向上走一层都能命中。
// 同名包只保留第一个（已存在的顶层链接优先），已存在的绝不覆盖。
//
// 用法： node scripts/hoist-links.mjs [node_modules 路径] [--dry-run]

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const explicit = args.find((a) => !a.startsWith('--'));
const ROOT = path.resolve(explicit ?? path.join(import.meta.dirname, '..', 'node_modules'));
const STORE = path.join(ROOT, '.pnpm');

if (!fs.existsSync(STORE)) {
  console.error(`[hoist] 找不到 pnpm 存储目录: ${STORE}`);
  process.exit(1);
}

/** 收集：包名 -> 真实目录（第一个出现的版本胜出，按名字排序保证结果稳定） */
const wanted = new Map();
const storeDirs = fs
  .readdirSync(STORE, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
  .map((d) => d.name)
  .sort();

for (const dir of storeDirs) {
  const nm = path.join(STORE, dir, 'node_modules');
  if (!fs.existsSync(nm)) continue;
  for (const entry of fs.readdirSync(nm, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) {
      // 作用域包：@scope 目录下才是包本体
      const scopeDir = path.join(nm, entry.name);
      for (const scoped of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (!scoped.isDirectory()) continue;
        const name = `${entry.name}/${scoped.name}`;
        if (!wanted.has(name)) wanted.set(name, path.join(scopeDir, scoped.name));
      }
    } else {
      if (!wanted.has(entry.name)) wanted.set(entry.name, path.join(nm, entry.name));
    }
  }
}

let created = 0;
let existed = 0;
const conflicts = [];

for (const [name, target] of [...wanted.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const link = path.join(ROOT, name);
  if (fs.existsSync(link)) {
    existed++;
    continue;
  }
  if (DRY) {
    console.log(`[dry] ${name} -> ${path.relative(ROOT, target)}`);
    created++;
    continue;
  }
  fs.mkdirSync(path.dirname(link), { recursive: true });
  try {
    fs.symlinkSync(target, link, 'junction');
    created++;
  } catch (err) {
    conflicts.push(`${name}: ${err.message}`);
  }
}

console.log(
  `[hoist] 顶层已存在 ${existed}，新建 junction ${created}，失败 ${conflicts.length}` +
    `${DRY ? '（dry-run 未落盘）' : ''}`
);
for (const c of conflicts.slice(0, 10)) console.warn(`[hoist] 失败 ${c}`);
process.exit(conflicts.length === 0 ? 0 : 2);
