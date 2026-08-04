import { Link } from 'react-router-dom'
import { demos } from './registry'

export function Home() {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>検索UI大喜利</h1>
        <p style={styles.lead}>
          検索という行為をわざと壊してみる実験場。{' '}
          {demos.filter((d) => d.Component).length} / {demos.length} 実装済み。
        </p>
      </header>

      <ul style={styles.list}>
        {demos.map((demo) => {
          const body = (
            <>
              <span style={styles.cardTitle}>{demo.title}</span>
              <span style={styles.cardSummary}>{demo.summary}</span>
            </>
          )

          return (
            <li key={demo.id}>
              {demo.Component ? (
                <Link to={`/${demo.id}`} style={{ ...styles.card, ...styles.cardLink }}>
                  {body}
                </Link>
              ) : (
                <div style={{ ...styles.card, ...styles.cardTodo }}>
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
  page: { maxWidth: 760, margin: '0 auto', padding: '48px 24px 96px' },
  header: { marginBottom: 40 },
  title: { fontSize: 40, margin: '0 0 8px' },
  lead: { margin: 0, fontSize: 16 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: 10,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '16px 20px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    textDecoration: 'none',
    position: 'relative',
  },
  cardLink: { color: 'inherit', background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' },
  cardTodo: { opacity: 0.55 },
  cardTitle: { fontSize: 18, color: 'var(--text-h)', fontWeight: 500 },
  cardSummary: { fontSize: 14, lineHeight: 1.5 },
  todoBadge: {
    position: 'absolute',
    top: 16,
    right: 20,
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid var(--border)',
  },
}
