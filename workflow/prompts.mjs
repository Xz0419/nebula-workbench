// 提示词模板版本。v2-bad 是一次**真实的提示词回归**：
// 为了"回答更自然"把输出格式约束删掉了，下游 JSON 校验就会失败。
// 这不是人造异常，是真实团队最常踩的坑。

export const PROMPTS = {
  v1: {
    version: 'v1',
    note: '要求严格 JSON 输出并给出引用',
    build: (context, question) =>
      [
        '你是 Nebula Cloud 的客服助手。只依据下面的资料回答，不得编造。',
        '必须输出 JSON：{"answer": "...", "citations": ["doc-id", "..."]}',
        '',
        '资料：',
        context,
        '',
        `问题：${question}`,
      ].join('\n'),
  },
  'v2-bad': {
    version: 'v2-bad',
    note: '删掉输出格式约束，改为自然语言（回归版本）',
    build: (context, question) =>
      [
        '你是 Nebula Cloud 的客服助手。根据资料自然地回答问题，语气友好。',
        '',
        '资料：',
        context,
        '',
        `问题：${question}`,
      ].join('\n'),
  },
}

export function getPrompt(version) {
  const prompt = PROMPTS[version]
  if (!prompt) throw new Error(`未知的提示词版本: ${version}`)
  return prompt
}
