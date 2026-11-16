import { Link } from '../router/router'

export function Footer() {
  return <footer className="footer landing-footer"><div className="landing-wrap landing-footer__inner"><div><Link className="brand" to="/"><span className="brand__mark" aria-hidden="true" /><span className="brand__name">Nebula</span></Link><p>让每一张工单，都有清晰的下一步。</p></div><div className="landing-footer__links"><Link to="/console">工作台</Link><Link to="/login">登录</Link><Link to="/settings">设置</Link></div><span>NEBULA WORKBENCH · AI 工单助理</span></div></footer>
}
