// AI 处理引擎：检索知识库 → 拼提示词 → 调模型 → 校验 → 给出置信度。
//
// 与告警/根因无关：这里只负责"把一件事做完，并说明它有多确定"。
// 置信度是规则算出来的（不是模型自报），所以在界面上可以解释：
//   检索质量 40% + 输出合法 30% + 引用充分度 30%
import { retrieve, isRelevant } from '../workflow/corpus.mjs'
import { getPrompt, PROMPTS } from '../workflow/prompts.mjs'
import { callModel, MODELS, PROVIDERS } from '../workflow/llm.mjs'
import * as db from './db.mjs'
import { config } from './config.mjs'

const round2 = (n) => Math.round(n * 100) / 100

/**
 * 置信度：可解释、可复现，不依赖模型自评。
 *   相关度 75%（检索分数 40% + 查询覆盖率 60%，命中标题再加 0.1）
 *   引用充分度 25%
 * 相关度不够时根本不会走到这里——先被 isRelevant 挡住转人工。
 */
function scoreConfidence({ score, coverage, titleHit, citations }) {
  const relevance = Math.min(
    1,
    0.4 * Math.min(1, (score ?? 0) / 10) +
      0.6 * Math.min(1, (coverage ?? 0) / 0.45) +
      (titleHit ? 0.1 : 0),
  )
  const citationScore = Math.min(1, (citations ?? 0) / 2)
  return round2(Math.max(0, Math.min(1, 0.75 * relevance + 0.25 * citationScore)))
}

/**
 * 处理一张工单：成功则写回 AI 答复与置信度，失败则标记转人工。
 * @returns {Promise<{ticket: object, run: object, stages: object[], confidence: number|null}>}
 */
export async function processTicket(
  ticket,
  {
    version = config.aiVersion,
    model = config.aiModel,
    provider = 'sim',
    baseUrl = '',
    apiKey = '',
    dryRun = false,
  } = {},
) {
  const startedAt = Date.now()
  const stages = []
  let tokensIn = 0
  let tokensOut = 0

  const step = async (name, fn) => {
    const begin = Date.now()
    try {
      const value = await fn()
      stages.push({ name, status: 'ok', ms: Date.now() - begin, detail: value?.detail ?? '', ...(value?.documents ? { documents: value.documents } : {}) })
      return value?.value
    } catch (error) {
      stages.push({ name, status: 'failed', ms: Date.now() - begin, detail: error.message })
      throw Object.assign(error, { stage: name })
    }
  }

  const question = `${ticket.subject}\n${ticket.body}`

  try {
    const docs = await step('retrieve', async () => {
      const found = retrieve(question, 3, db.listKnowledge(true))
      const top = found[0]
      if (!top || !isRelevant(top)) {
        throw new Error(
          `知识库中未找到足够相关的资料（最高相关度 ${Math.round((top?.coverage ?? 0) * 100)}%），转人工处理`,
        )
      }
      return { value: found, detail: `命中 ${found.length} 篇，相关度 ${Math.round(top.coverage * 100)}%`, documents: found.map(({ id, title, text, score, coverage }) => ({ id, title, text: text.slice(0, 500), score, coverage })) }
    })

    const prompt = await step('build_prompt', async () => {
      const context = docs.map((doc) => `[${doc.id}] ${doc.title}：${doc.text}`).join('\n')
      const built = getPrompt(version).build(context, question)
      return { value: built, detail: `${version} · ${built.length} 字符` }
    })

    const completion = await step('llm_call', async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), provider === 'sim' ? 10_000 : 45_000)
      try {
        const out = await callModel({
          prompt,
          model,
          signal: controller.signal,
          runtimeConfig: { provider, baseUrl, apiKey },
        })
        return { value: out, detail: `${model} · out=${out.tokensOut} tokens` }
      } finally {
        clearTimeout(timer)
      }
    })
    tokensIn = completion.tokensIn
    tokensOut = completion.tokensOut

    const parsed = await step('validate', async () => {
      let json
      try {
        const raw = completion.text.trim()
        const normalized = raw
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '')
        json = JSON.parse(normalized)
      } catch {
        throw new Error('输出不是合法 JSON')
      }
      if (typeof json.answer !== 'string' || !json.answer.trim()) throw new Error('缺少 answer 字段')
      if (!Array.isArray(json.citations) || json.citations.length === 0) throw new Error('缺少引用')
      const allowed = new Set(docs.map((doc) => doc.id))
      if (json.citations.some((id) => typeof id !== 'string' || !allowed.has(id))) throw new Error('引用不属于检索结果')
      json.citations = [...new Set(json.citations)]
      return { value: json, detail: `引用 ${json.citations.length} 篇` }
    })

    const confidence = scoreConfidence({
      score: docs[0]?.score,
      coverage: docs[0]?.coverage,
      titleHit: docs[0]?.titleHit,
      citations: parsed.citations.length,
    })

    const latencyMs = Date.now() - startedAt
    if (dryRun) return { status: 'ok', answer: parsed.answer, citations: parsed.citations, confidence, latencyMs, stages }
    const updated = db.saveAiResult({
      ticketId: ticket.id,
      expectedRevision: ticket.revision,
      answer: parsed.answer,
      citations: parsed.citations,
      confidence,
      version,
      ms: latencyMs,
      tokensIn,
      tokensOut,
    })

    const run = db.insertAiRun({
      ticketId: ticket.id,
      version,
      model,
      status: 'ok',
      confidence,
      latencyMs,
      tokensIn,
      tokensOut,
      stages,
    })

    return { ticket: updated, run, stages, confidence }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    if (dryRun) return { status: 'failed', answer: null, citations: [], confidence: null, latencyMs, stages, error: `${error.stage ?? 'unknown'}: ${error.message}` }
    const updated = db.markAiFailure({
      ticketId: ticket.id,
      expectedRevision: ticket.revision,
      error: `${error.stage ?? 'unknown'}: ${error.message}`,
      version,
      ms: latencyMs,
    })
    const run = db.insertAiRun({
      ticketId: ticket.id,
      version,
      model,
      status: 'failed',
      latencyMs,
      tokensIn,
      tokensOut,
      errorStage: error.stage ?? 'unknown',
      error: error.message,
      stages,
    })
    return { ticket: updated, run, stages, confidence: null }
  }
}

export const AVAILABLE = {
  versions: Object.keys(PROMPTS),
  models: [
    ...new Set([
      ...Object.keys(MODELS),
      ...Object.values(PROVIDERS).flatMap((provider) => provider.models),
    ]),
  ],
  providers: Object.values(PROVIDERS).map((provider) => ({
    id: provider.id,
    label: provider.label,
    defaultBaseUrl: provider.defaultBaseUrl,
    defaultModel: provider.defaultModel,
    models: provider.models,
    requiresApiKey: provider.requiresApiKey,
  })),
}
