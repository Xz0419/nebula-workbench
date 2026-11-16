import { Link } from '../router/router'
import { scrollToSection } from '../lib/scroll'

const steps = [
  { n: '01', title: '接收工单', text: '在工作台创建工单，记录问题、客户与优先级。工单入库后立即进入 AI 处理流程。' },
  { n: '02', title: '检索与生成', text: '从启用的知识资料中检索相关内容，结合问题生成答复，并记录引用、耗时与模型版本。' },
  { n: '03', title: '判断与分流', text: '根据检索相关度和引用情况计算规则分数；未达到阈值或处理失败时，转入人工队列。' },
  { n: '04', title: '人工接手', text: '处理人员可以查看 AI 结果、采纳或编辑草稿，也可以直接撰写人工答复。' },
]

export function LandingView() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-wrap landing-hero__grid">
          <div className="landing-hero__copy">
            <div className="landing-kicker"><span /> NEBULA WORKBENCH <i /> AI 工单助理</div>
            <h1>让每一张工单，<br /><span>都有清晰的下一步。</span></h1>
            <p className="landing-lead">从问题进入，到知识检索、AI 起草和人工处理。Nebula 把分散的步骤放进一个工作台，让团队看得见过程，也接得住例外。</p>
            <div className="landing-actions">
              <Link className="landing-button landing-button--primary" to="/console">进入工作台 <span>↗</span></Link>
              <button className="landing-button landing-button--secondary" onClick={() => scrollToSection('flow')}>了解处理流程 <span>↓</span></button>
            </div>
            <div className="landing-hero__foot"><span>01 / 工单处理</span><span>02 / AI 辅助</span><span>03 / 效果观察</span></div>
          </div>
          <div className="product-window" aria-label="工单处理示意图">
            <div className="product-window__top"><span className="window-dots"><i /><i /><i /></span><span>NEBULA / WORKSPACE</span><span className="example-badge">示意内容</span></div>
            <div className="product-window__body">
              <aside className="preview-sidebar"><div className="preview-logo">✳ <b>nebula</b></div><small>WORKSPACE</small><div className="preview-side-active">▦ <span>工单工作台</span></div><div>◷ <span>处理记录</span></div><div>◈ <span>效果概览</span></div><div className="preview-side-bottom">● <span>AI 辅助处理</span></div></aside>
              <div className="preview-main"><div className="preview-heading"><div><small>工作台 / 工单详情</small><h3>一张工单的旅程</h3></div><span>•••</span></div>
                <div className="preview-ticket"><div className="preview-ticket__meta"><span>工单示例</span><span>● 待人工处理</span></div><h4>关于退款规则的咨询</h4><p>用户希望了解预付费产品的退款条件。</p><div className="preview-tags"><span>客户咨询</span><span>普通优先级</span></div></div>
                <div className="preview-ai"><div className="preview-ai__head"><span className="ai-icon">✳</span><div><b>AI 处理结果</b><small>基于知识资料生成</small></div><span className="preview-status">待确认</span></div><p>已找到相关的退款规则。请结合具体订单情况，确认后回复用户。</p><div className="preview-source">▤ &nbsp; 参考资料：退款规则 <span>↗</span></div></div>
                <div className="preview-bottom"><span>✧ 处理过程可追溯</span><span>查看详情 →</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="landing-wrap hero-strip"><span>BUILT FOR BETTER SUPPORT</span><p>让重复问题更有条理，让需要人的问题更快找到人。</p><span>↓ &nbsp; 向下探索</span></div>
      </section>

      <section className="landing-section intro-section" id="features"><div className="landing-wrap">
        <div className="section-heading"><div><span className="section-index">01 / THE WORKBENCH</span><h2>从收到问题开始，<br />把处理过程连接起来。</h2></div><p>不止是一段 AI 回答。Nebula 将工单、知识检索、处理结果与人工操作放在同一条链路中。</p></div>
        <div className="capability-grid">
          <article className="capability capability--large"><span className="capability-icon">▤</span><span className="capability-number">01 — TICKETS</span><h3>工单集中处理</h3><p>创建并查看工单，按状态关注待处理事项。在详情中查看问题、AI 结果和处理记录。</p><div className="mini-list"><div><span>退款规则咨询</span><em>待人工处理</em></div><div><span>账单周期问题</span><em>已处理</em></div><small>以上为示意内容</small></div></article>
          <article className="capability"><span className="capability-icon">✳</span><span className="capability-number">02 — AI ASSIST</span><h3>基于资料起草</h3><p>围绕知识库检索结果生成答复，并保留引用信息。资料不相关或处理失败时转人工。</p><div className="card-note">检索 → 生成 → 校验 → 分流</div></article>
          <article className="capability"><span className="capability-icon">◷</span><span className="capability-number">03 — INSIGHTS</span><h3>处理效果可观察</h3><p>查看自动处理、待人工数量和 AI 耗时，并按版本对比运行情况。节省人时基于配置的人工基线估算。</p><div className="card-note">工单指标 / 运行记录 / 审计</div></article>
        </div>
      </div></section>

      <section className="landing-section process-section" id="flow"><div className="landing-wrap process-layout"><div className="process-intro"><span className="section-index">02 / HOW IT WORKS</span><h2>AI 先走一遍，<br /><span>人始终在流程中。</span></h2><p>处理流程将检索、生成和判断分成明确的步骤。遇到不确定的问题，工作台会保留处理信息，方便人工继续。</p><div className="process-callout"><span>↳</span><p><b>从草稿到人工处理</b><br />处理人员可以采纳、修改或自行回复。</p></div></div><ol className="process-list">{steps.map((step) => <li key={step.n}><span>{step.n}</span><div><h3>{step.title}</h3><p>{step.text}</p></div><b>↗</b></li>)}</ol></div></section>

      <section className="landing-section trust-section" id="stats"><div className="landing-wrap trust-grid"><div><span className="section-index">03 / WHAT YOU CAN SEE</span><h2>每一次处理，<br />都有迹可循。</h2><p>在工作台查看运行结果和统计数据，理解工单如何被处理，也为后续调整提供依据。</p><Link className="text-link" to="/console">查看工作台 <span>↗</span></Link></div><div className="insight-list"><div><span>01</span><div><h3>工单状态</h3><p>区分自动处理、待人工和人工完成的工单。</p></div></div><div><span>02</span><div><h3>AI 运行记录</h3><p>查看处理阶段、耗时、模型与提示词版本。</p></div></div><div><span>03</span><div><h3>效果指标</h3><p>按时间窗口观察处理量、自动化率和估算节省人时。</p></div></div></div></div></section>

      <section className="landing-section start-section" id="cta"><div className="landing-wrap"><div className="start-panel"><div><span className="section-index">04 / GET STARTED</span><h2>从一张工单开始。</h2><p>进入工作台，创建问题，看看 AI 如何检索、处理并将需要关注的事项交给你。</p><Link className="landing-button landing-button--primary" to="/console">打开工作台 <span>↗</span></Link></div><div className="start-detail"><strong>使用前了解</strong><p>当前默认使用离线模拟模型和示例知识资料，资料可在工作台维护；接入真实模型需要配置服务地址、密钥及模型名称。</p><p>工单答复保存在系统内；对外渠道的接入和消息投递需要另行建设。</p></div></div></div></section>
    </div>
  )
}
