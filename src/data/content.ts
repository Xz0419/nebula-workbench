import type { Feature, KpiCard, Stat, Step } from '../types'

/** 落地页首屏的三张能力卡（讲机制，不吹业绩） */
export const KPIS: KpiCard[] = [
  {
    label: 'AI 处理耗时',
    value: '秒级',
    delta: '检索 + 生成 + 校验',
    trend: 'down',
    bars: [0.36, 0.52, 0.44, 0.68, 0.58, 0.82, 0.72, 0.96],
  },
  {
    label: '自动处理阈值',
    value: '0.6',
    delta: '低于就转人工',
    trend: 'up',
    bars: [0.70, 0.56, 0.62, 0.40, 0.48, 0.34, 0.30, 0.26],
  },
  {
    label: '人工工作量',
    value: '1 分钟',
    delta: '改草稿即可发出',
    trend: 'down',
    bars: [0.64, 0.74, 0.58, 0.66, 0.48, 0.54, 0.44, 0.50],
  },
]

/** 系统里的真实设定值，不是市场数据 */
export const STATS: Stat[] = [
  { value: 0.6, decimals: 1, suffix: '', label: '自动答复的置信度阈值' },
  { value: 100, decimals: 0, suffix: '%', label: '答复带知识库原文引用' },
  { value: 8, decimals: 0, suffix: ' 分钟', label: '人工处理基线（可配置）' },
  { value: 1, decimals: 0, suffix: ' 次', label: '人工只需确认，不需重读' },
]

export const FEATURES: Feature[] = [
  {
    icon: 'sparkle',
    title: '自动答复',
    desc: '检索知识库 → 生成答复 → 校验引用 → 打分。分数够就自动发出，不够就带着草稿转人工，绝不硬答。',
    wide: true,
  },
  {
    icon: 'users',
    title: '人工只做确认',
    desc: '转过来的工单已经写好答复和依据，改两个字就能发。人工从"重读一遍问题"变成"看一眼"。',
  },
  {
    icon: 'pulse',
    title: '效率可核算',
    desc: '自动化率、节省人时、单均耗时，全部来自真实工单与真实调用记录；换提示词之后效果变好还是变差，按版本对比。',
  },
]

export const STEPS: Step[] = [
  {
    index: '01',
    title: '接入工单',
    desc: '邮件、表单、企业微信都能推过来：POST /api/tickets 一行，工单立刻进入 AI 处理。',
  },
  {
    index: '02',
    title: 'AI 先处理',
    desc: '检索知识库、生成答复、校验引用，算出一个可解释的置信度——不是模型自评。',
  },
  {
    index: '03',
    title: '人工兜底',
    desc: '低于阈值的进待人工队列，带着草稿；确认即可发出，处理时长和节省人时自动记账。',
  },
]

/** 首屏折线图（归一化 0~1），交给 buildSmoothPath 转成 SVG */
export const TREND_SERIES = [
  0.28, 0.42, 0.36, 0.58, 0.5, 0.72, 0.64, 0.86, 0.78, 0.94, 0.88, 0.97,
]

export const LOGOS = ['VECTOR', 'ORBIT', 'LUMEN', 'NIMBUS', 'HELIX']
