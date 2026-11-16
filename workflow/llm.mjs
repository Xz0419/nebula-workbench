// 模型适配器。
//
// 默认 sim：离线确定性"模型"，行为取决于提示词——提示词里有 JSON 约束就返回 JSON，
// 没有就返回自然语言。这让"提示词回归导致下游校验失败"成为真实发生的故障，
// 而不是脚本里硬造的异常。
//
// 运行时可选择本地模拟、DeepSeek 或任意 OpenAI 兼容接口。

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const MODELS = {
  'sim-v1': { name: 'sim-v1', latencyMs: 40, slow: false },
  'sim-slow': { name: 'sim-slow', latencyMs: 3400, slow: true },
}

export const PROVIDERS = {
  sim: {
    id: 'sim',
    label: '本地模拟',
    defaultBaseUrl: '',
    defaultModel: 'sim-v1',
    models: ['sim-v1', 'sim-slow'],
    requiresApiKey: false,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-flash',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
    requiresApiKey: true,
  },
  compatible: {
    id: 'compatible',
    label: 'OpenAI 兼容接口',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4.1-mini'],
    requiresApiKey: true,
  },
}

function extractContextIds(prompt) {
  // 从"资料："段落里抽取 doc-id 列表
  const ids = []
  const re = /\[(doc[-_][a-zA-Z0-9_-]+)\]/g
  let match
  while ((match = re.exec(prompt)) !== null) ids.push(match[1])
  return [...new Set(ids)]
}

function extractQuestion(prompt) {
  const match = prompt.match(/问题：(.+)$/m)
  return match ? match[1].trim() : ''
}

async function callSim({ prompt, model, signal }) {
  const spec = MODELS[model]
  if (!spec) throw Object.assign(new Error(`未知模型: ${model}`), { code: 'unknown_model' })

  if (spec.slow) {
    // 真实地慢：分片 sleep，允许被 abort
    const step = 200
    for (let waited = 0; waited < spec.latencyMs; waited += step) {
      if (signal?.aborted) throw Object.assign(new Error('请求被取消'), { code: 'aborted' })
      await sleep(Math.min(step, spec.latencyMs - waited))
    }
  } else {
    await sleep(spec.latencyMs)
  }

  const ids = extractContextIds(prompt)
  const question = extractQuestion(prompt)
  const answer = ids.length
    ? `根据资料，${question.replace(/[？?]$/, '')}的规定见 ${ids[0]}。`
    : '资料中没有找到相关信息。'

  // 提示词要求 JSON 才返回 JSON —— 与真实模型的"遵循指令"行为一致
  const requiresJson = /必须输出\s*JSON/.test(prompt)
  if (requiresJson) {
    return {
      text: JSON.stringify({ answer, citations: ids.slice(0, 2) }),
      tokensIn: Math.ceil(prompt.length / 2),
      tokensOut: 40,
    }
  }

  return {
    text: `${answer}（补充说明：如需进一步协助请联系支持团队。）`,
    tokensIn: Math.ceil(prompt.length / 2),
    tokensOut: 48,
  }
}

function completionsUrl(baseUrl) {
  const base = baseUrl.trim().replace(/\/$/, '')
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
}

async function callOpenAI({ prompt, model, signal, baseUrl, apiKey }) {
  if (!baseUrl || !apiKey) {
    throw Object.assign(new Error('未配置接口地址或 API Key'), { code: 'not_configured' })
  }

  const res = await fetch(completionsUrl(baseUrl), {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  })
  if (!res.ok) {
    const hints = { 401: 'API Key 无效或未授权', 402: '账户余额不足', 429: '请求过于频繁，请稍后重试', 500: '模型服务内部错误', 503: '模型服务繁忙，请稍后重试' }
    throw Object.assign(new Error(`模型返回 HTTP ${res.status}：${hints[res.status] || '请检查模型和接口配置'}`), { code: 'model_http_error' })
  }
  const data = await res.json()
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  }
}

export async function callModel({ prompt, model, signal, fault, runtimeConfig }) {
  if (fault === 'llm_timeout') {
    await sleep(4000)
    throw Object.assign(new Error('模型调用超时（4s）'), { code: 'llm_timeout' })
  }
  if (fault === 'llm_500') {
    throw Object.assign(new Error('模型服务返回 500'), { code: 'llm_http_500' })
  }

  const configuredProvider = runtimeConfig?.provider
  const inferredProvider =
    process.env.OPENAI_BASE_URL?.includes('deepseek')
      ? 'deepseek'
      : process.env.OPENAI_BASE_URL
        ? 'compatible'
        : 'sim'
  const provider = PROVIDERS[configuredProvider] ? configuredProvider : inferredProvider

  if (provider === 'sim') return callSim({ prompt, model, signal })

  const preset = PROVIDERS[provider]
  const baseUrl =
    runtimeConfig?.baseUrl?.trim() ||
    process.env.OPENAI_BASE_URL ||
    preset.defaultBaseUrl
  const apiKey =
    runtimeConfig?.apiKey?.trim() ||
    (provider === 'deepseek'
      ? process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
      : process.env.OPENAI_API_KEY)

  if (model?.startsWith('sim-')) {
    throw new Error('真实模型模式需要使用实际模型名称')
  }
  return callOpenAI({ prompt, model, signal, baseUrl, apiKey })
}
