import { FEATURES } from '../data/content'
import { delay } from '../lib/style'
import { Icon } from './Icon'

/** 跨列卡片右侧的旋转轨道装饰 */
function Orbit() {
  return (
    <div className="orbit" aria-hidden="true">
      <span className="orbit__ring">
        <i />
      </span>
      <span className="orbit__ring orbit__ring--2">
        <i />
      </span>
      <span className="orbit__core" />
    </div>
  )
}

export function Features() {
  return (
    <section className="section" id="features">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="eyebrow">核心能力</span>
          <h2>
            把复杂留给我们，
            <br />
            把清晰留给你
          </h2>
          <p>从数据接入到洞察分发，一条链路全部打通，不用再拼装五个工具。</p>
        </div>

        <div className="bento">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className={`card reveal${feature.wide ? ' feat--wide' : ''}`}
              style={delay(index * 0.04)}
            >
              <div>
                <div className="feat__icon">
                  <Icon name={feature.icon} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>

                {feature.icon === 'code' && (
                  <pre className="code">
                    <code>
                      <span className="c"># 安装并接入</span>
                      {'\n'}npm i @nebula/sdk{'\n'}nebula.<span className="k">track</span>(
                      <span className="s">'order.created'</span>, {'{ amount }'})
                    </code>
                  </pre>
                )}
              </div>
              {feature.wide && <Orbit />}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
