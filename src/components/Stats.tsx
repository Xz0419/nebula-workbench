import { STATS } from '../data/content'
import { delay } from '../lib/style'
import { CountUp } from './CountUp'

export function Stats() {
  return (
    <section className="stats" id="stats">
      <div className="wrap">
        <div className="stats__grid">
          {STATS.map((stat, index) => (
            <div className="stat reveal" key={stat.label} style={delay(index * 0.06)}>
              <b>
                <CountUp value={stat.value} decimals={stat.decimals} />
                {stat.suffix}
              </b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
