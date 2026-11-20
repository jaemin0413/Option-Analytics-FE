import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api, tokens } from '../api'

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
)
const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
)

// 헤더 검색창에 치면 그 자리에서 결과가 펼쳐진다
function Search() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ symbol: string; name: string | null }[]>([])
  const [loaded, setLoaded] = useState('')
  const navigate = useNavigate()
  const key = q.trim().toUpperCase()

  useEffect(() => {
    if (!key) return
    // 늦게 온 이전 검색어 응답이 새 결과를 덮지 않게 한다
    let alive = true
    const timer = setTimeout(() => {
      api.search(key)
        .then((r) => { if (alive) { setResults(r); setLoaded(key) } })
        .catch(() => { if (alive) { setResults([]); setLoaded(key) } })
    }, 200)
    return () => { alive = false; clearTimeout(timer) }
  }, [key])

  function go(symbol: string) {
    setQ('')
    navigate(`/ticker/${symbol}`)
  }

  return (
    <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (loaded === key && results[0]) go(results[0].symbol) }}>
      <div className="search-box">
        <SearchIcon />
        <input type="search" aria-label="종목 검색" placeholder="종목 검색" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoCapitalize="characters" />
      </div>
      {key && loaded === key && (
        <section className="search-results" aria-label="검색 결과">
          {results.map((r) => (
            <Link key={r.symbol} className="search-item" to={`/ticker/${r.symbol}`} onClick={() => setQ('')}>
              <span className="row" style={{ alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{r.symbol}</span>
                {r.name && <span className="muted">{r.name}</span>}
              </span>
              <Chevron />
            </Link>
          ))}
          {results.length === 0 && (
            <div role="status" style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600 }}>‘{q.trim()}’로 시작하는 심볼이 없습니다</span>
              <span className="muted">영문 심볼로 검색해 주세요. 예: NVDA</span>
            </div>
          )}
        </section>
      )}
    </form>
  )
}

function AccountSheet({ onClose }: { onClose: () => void }) {
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  // 토큰에 이메일이 없어서 로그인할 때 적어 둔 값을 보여준다
  const email = localStorage.getItem('email')
  const ref = useRef<HTMLDivElement>(null)

  // 열면 포커스를 시트 안으로, 닫으면 원래 자리로 돌려준다
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => prev?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function leave(action: () => Promise<void>) {
    try {
      await action()
      tokens.clear()
      navigate('/login')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div ref={ref} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby="acc-h" onClick={(e) => e.stopPropagation()}>
        <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line)', alignSelf: 'center' }} />
        <div>
          <h1 id="acc-h" style={{ fontSize: 22 }}>계정</h1>
          {email && <p className="sub" style={{ fontSize: 15 }}>{email}</p>}
        </div>
        {/* 서버 로그아웃이 실패해도 이 기기에서는 로그아웃한다 */}
        <button type="button" className="btn btn-weak" onClick={() => leave(() => api.logout().catch(() => {}))}>로그아웃</button>
        <details>
          <summary>회원 탈퇴<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}>
            <p className="sub">계정이 삭제되고 되돌릴 수 없습니다. 다시 쓰려면 새로 가입해야 합니다.</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer' }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 20, height: 20, margin: 0, accentColor: 'var(--red)' }} />
              되돌릴 수 없다는 것을 확인했습니다
            </label>
            <button type="button" className="btn" disabled={!agreed} style={agreed ? { height: 48, background: 'var(--red)' } : { height: 48 }} onClick={() => leave(api.withdraw)}>탈퇴하기</button>
          </div>
        </details>
        {error && <p className="err">{error}</p>}
        <button type="button" className="btn" style={{ height: 48, background: 'transparent', color: 'var(--ink2)', fontWeight: 400 }} onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}

export function Layout() {
  const [account, setAccount] = useState(false)

  return (
    <div className="page">
      <div className="wrap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <header className="header">
            <Link to="/" className="logo">Option</Link>
            <Search />
            <button type="button" className="icon-btn" aria-label="계정 메뉴" onClick={() => setAccount(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
            </button>
          </header>
          <nav className="nav" aria-label="주 메뉴">
            <NavLink to="/" end>대시보드</NavLink>
            <NavLink to="/hit-rates">검증</NavLink>
            <NavLink to="/journal">저널</NavLink>
          </nav>
        </div>
        <Outlet />
      </div>
      {account && <AccountSheet onClose={() => setAccount(false)} />}
    </div>
  )
}
