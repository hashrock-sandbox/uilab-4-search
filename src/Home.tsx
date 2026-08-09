import { Link } from 'react-router-dom'
import { demos } from './registry'
import './Home.css'

export function Home() {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>検索UI大喜利</h1>
      </header>

      <ul style={styles.list}>
        {demos.map((demo) => {
          const body = (
            <>
              <span className="home-row-title" style={styles.rowTitle}>
                {demo.title}
              </span>
              <span style={styles.rowSummary}>{demo.summary}</span>
            </>
          )

          return (
            <li key={demo.id} style={styles.row}>
              {demo.Component ? (
                <Link to={`/${demo.id}`} className="home-row-link" style={styles.rowLink}>
                  {body}
                </Link>
              ) : (
                <div style={styles.rowTodo}>
                  {body}
                  <span style={styles.todoBadge}>未実装</span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 640, margin: '0 auto', padding: '48px 24px 96px', textAlign: 'left' },
  header: { marginBottom: 40 },
  title: { fontSize: 40, margin: '0 0 8px' },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  row: {
    borderBottom: '1px solid var(--border)',
  },
  rowLink: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '18px 0',
    textDecoration: 'none',
    color: 'inherit',
  },
  rowTodo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '18px 0',
    position: 'relative',
    opacity: 0.5,
  },
  rowTitle: { fontSize: 17, color: 'var(--text-h)', fontWeight: 500 },
  rowSummary: { fontSize: 14, lineHeight: 1.5 },
  todoBadge: {
    position: 'absolute',
    top: 18,
    right: 0,
    fontSize: 12,
  },
}
