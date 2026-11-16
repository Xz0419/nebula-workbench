import { STEPS } from '../data/content'
import { delay } from '../lib/style'

export function Flow() {
  return (
    <section className="section" id="flow">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="eyebrow">怎么开始</span>
          <h2>三步，从数据到结论</h2>
        </div>

        <ol className="flow">
          {STEPS.map((step, index) => (
            <li className="flow__item reveal" key={step.index} style={delay(index * 0.08)}>
              <span className="flow__num">{step.index}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
