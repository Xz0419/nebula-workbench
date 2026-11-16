import { useEffect, useMemo, useState } from 'react'
import type {
  AiConfig,
  AiConfigInfo,
  AiConfigInput,
  AiProviderId,
} from '../../types'
import { saveAiConfig, testAiConfig } from '../../lib/api'
import { ConsoleIcon } from './ConsoleIcon'

interface AiConfigPanelProps {
  aiInfo: AiConfigInfo | null
  onSaved: (config: AiConfig) => void
}

export function AiConfigPanel({ aiInfo, onSaved }: AiConfigPanelProps) {
  const [draft, setDraft] = useState<AiConfigInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{
    tone: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    if (!aiInfo) return
    const config = aiInfo.config
    setDraft({
      provider: config.provider,
      version: config.version,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: '',
    })
  }, [aiInfo])

  const providers = useMemo(
    () =>
      aiInfo?.available.providers ?? [
        {
          id: 'sim' as const,
          label: '本地模拟',
          defaultBaseUrl: '',
          defaultModel: 'sim-v1',
          models: ['sim-v1', 'sim-slow'],
          requiresApiKey: false,
        },
      ],
    [aiInfo],
  )
  const provider = providers.find((item) => item.id === draft?.provider)
  const isSimulation = draft?.provider === 'sim'
  const hasKeyForDraft =
    Boolean(aiInfo) &&
    draft?.provider === aiInfo?.config.provider &&
    Boolean(aiInfo?.config.apiKeyConfigured)

  function changeProvider(providerId: AiProviderId) {
    const next = providers.find((item) => item.id === providerId)
    if (!next || !draft) return
    setDraft({
      ...draft,
      provider: providerId,
      model: next.defaultModel,
      baseUrl: next.defaultBaseUrl,
      apiKey: '',
    })
    setMessage(null)
  }

  function currentInput(): AiConfigInput | null {
    if (!draft) return null
    const apiKey = draft.apiKey?.trim()
    return {
      ...draft,
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
      ...(apiKey ? { apiKey } : {}),
    }
  }

  async function handleTest() {
    const input = currentInput()
    if (!input) return
    setTesting(true)
    setMessage(null)
    try {
      const result = await testAiConfig(input)
      setMessage({
        tone: 'success',
        text: `${result.message}，耗时 ${result.latencyMs} ms。`,
      })
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : '连接测试失败',
      })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    const input = currentInput()
    if (!input) return
    setSaving(true)
    setMessage(null)
    try {
      const result = await saveAiConfig(input)
      setDraft({ ...input, apiKey: '' })
      onSaved(result.config)
      setMessage({
        tone: 'success',
        text: result.changed ? 'AI 配置已保存并立即生效。' : '当前配置没有变化。',
      })
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'AI 配置保存失败',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="surface settings-card ai-config-card">
      <header className="settings-card__header">
        <div>
          <h2>AI 服务配置</h2>
          <p>配置实际模型接口，保存后新工单立即使用新配置。</p>
        </div>
        <span
          className={`status-badge status-badge--${
            draft?.provider === 'sim'
              ? 'neutral'
              : hasKeyForDraft
                ? 'success'
                : 'warning'
          }`}
        >
          {draft?.provider === 'sim'
            ? '模拟运行'
            : hasKeyForDraft
              ? '已配置密钥'
              : '需要 API Key'}
        </span>
      </header>

      {!draft ? (
        <div className="ai-config-loading">正在读取 AI 配置…</div>
      ) : (
        <form
          className="ai-config-form"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSave()
          }}
        >
          <div className="form-row form-row--ai">
            <label className="field">
              <span>服务商</span>
              <select
                value={draft.provider}
                onChange={(event) => changeProvider(event.target.value as AiProviderId)}
              >
                {providers.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>提示词版本</span>
              <select
                value={draft.version}
                onChange={(event) => setDraft({ ...draft, version: event.target.value })}
              >
                {(aiInfo?.available.versions ?? ['v1']).map((version) => (
                  <option value={version} key={version}>
                    {version}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>模型名称</span>
            <input
              required
              maxLength={200}
              list="ai-model-options"
              value={draft.model}
              onChange={(event) => setDraft({ ...draft, model: event.target.value })}
              placeholder={provider?.defaultModel || 'deepseek-flash'}
            />
            <datalist id="ai-model-options">
              {(provider?.models ?? aiInfo?.available.models ?? []).map((model) => (
                <option value={model} key={model} />
              ))}
            </datalist>
          </label>

          <label className="field">
            <span>接口地址</span>
            <input
              type="url"
              value={draft.baseUrl}
              disabled={isSimulation}
              onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
              placeholder={isSimulation ? '本地模拟不需要接口地址' : provider?.defaultBaseUrl}
            />
            <small>
              {isSimulation
                ? '本地模拟不会调用外部服务，适合离线演示。'
                : `实际请求 ${draft.baseUrl.replace(/\/$/, '')}/chat/completions`}
            </small>
          </label>

          {!isSimulation ? (
            <label className="field">
              <span>API Key</span>
              <input
                type="password"
                autoComplete="new-password"
                value={draft.apiKey ?? ''}
                onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                placeholder={
                  hasKeyForDraft
                    ? '已配置；留空表示继续使用原密钥'
                    : '填写服务商 API Key'
                }
              />
              <small>密钥仅写入本机 data/ai-config.json，不会通过配置查询接口返回。</small>
            </label>
          ) : null}

          {draft.provider === 'deepseek' ? (
            <div className="provider-note">
              <ConsoleIcon name="bot" size={16} />
              <span>
                DeepSeek 使用 OpenAI 兼容接口。推荐模型：<code>deepseek-flash</code>；
                更复杂任务可填写 <code>deepseek-v4-pro</code>。
              </span>
            </div>
          ) : null}

          {message ? (
            <div className={`config-message config-message--${message.tone}`} role="status">
              {message.text}
            </div>
          ) : null}

          <div className="ai-config-actions">
            <span>建议先测试连接，再保存配置。</span>
            <div className="action-bar">
              <button
                className="button button--secondary"
                type="button"
                disabled={testing || saving}
                onClick={() => void handleTest()}
              >
                <ConsoleIcon name="external" size={15} />
                {testing ? '正在测试…' : '测试连接'}
              </button>
              <button className="button button--primary" type="submit" disabled={saving || testing}>
                {saving ? '正在保存…' : '保存配置'}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  )
}
