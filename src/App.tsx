import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Home } from './Home'
import { buildableDemos, demos } from './registry'

function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const current = demos.find((demo) => `/${demo.id}` === pathname)

  return (
    <div>
      <nav style={styles.nav}>
        <Link to="/" style={styles.home}>
          {current ? '← 検索UI大喜利' : '検索UI大喜利'}
        </Link>
        {current && <span style={styles.current}>{current.title}</span>}
      </nav>
      {children}
    </div>
  )
}

function NotFound() {
  return (
    <div style={styles.notFound}>
      <p>そのネタはまだありません。</p>
      <Link to="/">一覧へ</Link>
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          {buildableDemos.map(({ id, Component }) => (
            <Route key={id} path={`/${id}`} element={<Component />} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    padding: '14px 24px',
    borderBottom: '1px solid var(--border)',
    fontSize: 15,
  },
  home: { color: 'var(--accent)', textDecoration: 'none' },
  current: { color: 'var(--text-h)' },
  notFound: { padding: 48, textAlign: 'center' },
}

export default App
