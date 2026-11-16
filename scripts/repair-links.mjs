#!/usr/bin/env node
// 修复被压平的 pnpm 符号链接。
//
// 场景：整个项目在拷贝/压缩时没有保留符号链接，pnpm 在 node_modules 里放的
// 相对符号链接变成了内容为目标路径的小文本文件，例如
//   node_modules/typescript  内容 = ".pnpm/typescript@5.9.3/node_modules/typescript/"
// 结果 node 无法解析模块。本脚本把这类占位文件还原成 Windows 目录联接（junction）。
//
// 判定条件（三重要求，避免误伤真实文件）：
//   1. 是普通文件、体积很小（<= 400B）
//   2. 内容单行、字符集像路径（字母数字 @ . + - _ ~ / \）
//   3. 相对于该文件所在目录解析后，目标真实存在
//
// 用法： node scripts/repair-links.mjs [--dry-run]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : path.join(import.meta.dirname, '..', 'node_modules'));
const DRY = process.argv.includes('--dry-run');
const MAX_PASSES = 6;
const PATHISH = /^[A-Za-z0-9@._+\-~/\\]+$/;

if (!fs.existsSync(ROOT)) {
  console.error(`[repair] 目录不存在: ${ROOT}`);
  process.exit(1);
}

/** 递归收集所有候选占位文件 */
function collect(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      collect(full, out);
    } else if (e.isFile()) {
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (st.size === 0 || st.size > 400) continue;
      let text;
      try {
        text = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      if (text.includes('\n') || text.includes('\r')) continue;
      const target = text.trim();
      if (!target || !PATHISH.test(target)) continue;
      // 必须真的像链接：解析后目标存在
      const abs = path.resolve(dir, target);
      if (!fs.existsSync(abs)) continue;
      out.push({ linkPath: full, raw: target, absTarget: abs });
    }
  }
}

const stats = { repairedDir: 0, repairedFile: 0, skipped: 0, failed: 0, pending: 0 };

let pass = 0;
for (; pass < MAX_PASSES; pass++) {
  const candidates = [];
  collect(ROOT, candidates);
  if (candidates.length === 0) break;

  let changed = 0;
  for (const c of candidates) {
    let isDir = false;
    try {
      isDir = fs.statSync(c.absTarget).isDirectory();
    } catch {
      stats.pending++;
      continue;
    }

    if (DRY) {
      console.log(`[dry] ${path.relative(ROOT, c.linkPath)} -> ${path.relative(ROOT, c.absTarget)}`);
      changed++;
      continue;
    }

    try {
      fs.rmSync(c.linkPath, { force: true });
      if (isDir) {
        fs.symlinkSync(c.absTarget, c.linkPath, 'junction');
        stats.repairedDir++;
      } else {
        // 文件级符号链接在 Windows 上通常需要管理员/开发者模式，直接复制更稳
        fs.copyFileSync(c.absTarget, c.linkPath);
        stats.repairedFile++;
      }
      changed++;
    } catch (err) {
      stats.failed++;
      if (stats.failed <= 5) console.error(`[repair] 失败 ${c.linkPath}: ${err.message}`);
    }
  }

  if (changed === 0) break;
  console.log(`[repair] 第 ${pass + 1} 轮：修复 ${changed} 个链接，剩余 ${candidates.length - changed} 个待解析`);
}

const left = [];
collect(ROOT, left);
console.log(
  `[repair] 完成：目录联接 ${stats.repairedDir}，文件复制 ${stats.repairedFile}，` +
    `失败 ${stats.failed}，仍未解析 ${left.length}${DRY ? '（dry-run 未落盘）' : ''}`
);
for (const l of left.slice(0, 10)) {
  console.warn(`[repair] 未处理: ${path.relative(ROOT, l.linkPath)} -> ${l.raw}`);
}
process.exit(left.length === 0 && stats.failed === 0 ? 0 : 2);
