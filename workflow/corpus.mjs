// 本地知识库 + 检索（真实实现，无外部依赖、无网络）。
// 语料是虚构产品的客服文档；检索用字符 bigram + IDF 打分，结果确定性可复现。

export const DOCS = [
  {
    id: 'doc-billing-cycle',
    title: '计费周期',
    text: 'Nebula Cloud 按自然月计费，账单在每月 1 日生成。按量资源以小时为粒度结算，包年包月资源在购买时一次性扣费。',
  },
  {
    id: 'doc-refund',
    title: '退款规则',
    text: '预付费包年包月产品在购买后 7 天内可申请无理由退款，超过 7 天按剩余天数折算。按量付费已消耗部分不支持退款。',
  },
  {
    id: 'doc-quota',
    title: '配额与限流',
    text: '每个账号默认 200 QPS 的 API 配额，可在控制台提交工单提升。突发流量超过配额会返回 429，建议客户端做指数退避重试。',
  },
  {
    id: 'doc-sla',
    title: '服务等级协议',
    text: '可用性 SLA 为 99.9%，按自然月统计。未达标时按不可用时长比例赔付，最高赔付当月费用的 30%。',
  },
  {
    id: 'doc-data-residency',
    title: '数据驻留',
    text: '中国大陆region 的数据存储在上海和北京可用区，不跨境传输。海外 region 数据存储在对应区域，可申请数据导出。',
  },
  {
    id: 'doc-invoice',
    title: '发票开具',
    text: '企业实名认证后可开具增值税专用发票，在控制台财务中心提交申请，3 个工作日内寄出。个人账号仅支持电子普通发票。',
  },
  {
    id: 'doc-ram',
    title: '子账号与权限',
    text: '主账号可创建子账号并绑定策略，支持按资源组做行级权限隔离。所有操作记录在操作审计中，保留 180 天。',
  },
  {
    id: 'doc-support',
    title: '技术支持',
    text: '基础版工单响应 8 小时，企业版 1 小时，专属版 15 分钟。紧急故障可走电话通道，7x24 小时值班。',
  },
]

/** 字符 bigram 切分，对中文友好且无需分词词典 */
function bigrams(text) {
  const clean = text.replace(/[\s，。、；：？！「」（）]/g, '')
  const grams = new Set()
  for (let i = 0; i < clean.length - 1; i++) grams.add(clean.slice(i, i + 2))
  return grams
}

/** 对当前启用的资料建立检索索引。 */
export function retrieve(query, topK = 3, documents = DOCS) {
  const index = documents.map((doc) => ({ doc, grams: bigrams(`${doc.title} ${doc.text}`), titleGrams: bigrams(doc.title) }))
  const df = new Map()
  for (const { grams } of index) for (const gram of grams) df.set(gram, (df.get(gram) ?? 0) + 1)
  const queryGrams = bigrams(query)
  const total = queryGrams.size || 1
  return index.map(({ doc, grams, titleGrams }) => {
    let score = 0, hits = 0, titleHit = false
    for (const gram of queryGrams) if (grams.has(gram)) {
      score += Math.log(1 + documents.length / (1 + (df.get(gram) ?? documents.length)))
      hits++
      if (titleGrams.has(gram)) titleHit = true
    }
    return { ...doc, score: Number(score.toFixed(3)), coverage: Number((hits / total).toFixed(3)), titleHit }
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, topK)
}

/**
 * 相关度闸门：分数高但覆盖率低，说明只是几个词碰巧重合（典型的"知识库里没有"）。
 * 实测数据：真问题时 score 6~11、coverage 0.17~0.47；假问题时 coverage 基本 < 0.1。
 *
 * 两条通路（任一成立即视为相关）：
 *   1) 命中文档标题 —— 强信号（"退款"命中"退款规则"）。短问题总分天然偏低，
 *      所以这里只要求 score >= 1.5，不能再按长问题的 3 分线卡。
 *   2) 没有标题命中时，要求分数和覆盖率同时达标，避免长问题靠零星词蒙对。
 */
export function isRelevant(doc) {
  if (!doc) return false
  if (doc.titleHit) return doc.score >= 1.5
  return doc.score >= 3 && doc.coverage >= 0.3
}
