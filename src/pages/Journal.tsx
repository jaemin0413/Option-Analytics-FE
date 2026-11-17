import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Direction, type JournalEntry, type Metric } from '../api'
import { Tip } from '../components/Tip'
import { useLoad } from '../useLoad'
import { day, marketOpenKst, num } from '../format'

// 보합 기준은 백엔드 채점 값과 같다
const FLAT_BAND = 0.0015

const DIRS: { id: Direction; label: string; sub: string; className: string }[] = [
  { id: 'UP', label: '▲ 상승', sub: '+0.15% 넘게', className: 'up' },
  { id: 'DOWN', label: '▼ 하락', sub: '−0.15% 넘게', className: 'down' },
  { id: 'FLAT', label: '보합', sub: '±0.15% 안', className: '' },
  { id: 'HOLD', label: '보류', sub: '채점 안 함', className: '' },
]
const DIR_TEXT: Record<Direction, string> = { UP: '▲ 상승', DOWN: '▼ 하락', FLAT: '보합 (±0.15% 안)', HOLD: '보류' }
const DIR_CLASS: Record<Direction, string> = { UP: 'up', DOWN: 'down', FLAT: '', HOLD: '' }

function ReturnText({ ret }: { ret: number | null }) {
  if (ret === null) return <span>—</span>
  const text = `${ret >= 0 ? '+' : '−'}${Math.abs(ret * 100).toFixed(2)}%`
  if (Math.abs(ret) <= FLAT_BAND) return <span>{text} 보합</span>
  return <span className={ret > 0 ? 'up' : 'down'}>{ret > 0 ? '▲' : '▼'} {text}</span>
}

function Result({ e }: { e: JournalEntry }) {
  if (e.direction === 'HOLD') return <span className="muted" style={{ fontSize: 15 }}>채점 없음</span>
  if (e.hit === null) return <span className="muted" style={{ fontSize: 15 }}>채점 전</span>
  return e.hit ? <b>✓ 적중</b> : <b style={{ color: 'var(--ink3)' }}>× 빗나감</b>
}

export function Journal() {
  const [params] = useSearchParams()
  const dashboard = useLoad(api.dashboard, [])
  const journals = useLoad(api.journals, [])
  const [symbol, setSymbol] = useState((params.get('symbol') ?? '').toUpperCase())
  const [direction, setDirection] = useState<Direction>('HOLD')
  const [memo, setMemo] = useState('')
  const [metric, setMetric] = useState<Metric | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const target = dashboard.data?.indexCards[0]?.targetSession ?? dashboard.data?.sectors[0]?.targetSession
  const open = target ? marketOpenKst(target) : null
  const locked = open ? Date.now() >= open.at.getTime() : true
  const [, redraw] = useState(0)

  // 마감 전에 열어 둔 화면도 마감 시각이 되면 잠근다
  const openAt = open?.at.getTime()
  useEffect(() => {
    if (!openAt || Date.now() >= openAt) return
    const timer = setTimeout(() => redraw((n) => n + 1), openAt - Date.now() + 500)
    return () => clearTimeout(timer)
  }, [openAt])

  // 종목을 치면 예상 범위를 옆에 보여준다
  useEffect(() => {
    setMetric(null)
    const key = symbol.trim()
    if (!key) return
    const timer = setTimeout(() => {
      api.ticker(key).then((d) => setMetric(d.metric)).catch(() => setMetric(null))
    }, 300)
    return () => clearTimeout(timer)
  }, [symbol])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!target) return
    setError(null)
    setSaved(false)
    try {
      const entry = await api.saveJournal({ symbol: symbol.trim().toUpperCase(), targetSession: target, direction, memo })
      const others = (journals.data ?? []).filter((j) => !(j.symbol === entry.symbol && j.targetSession === entry.targetSession))
      journals.setData([entry, ...others])
      setSaved(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  function edit(j: JournalEntry) {
    setSymbol(j.symbol)
    setDirection(j.direction)
    setMemo(j.memo ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const todays = (journals.data ?? []).filter((j) => j.targetSession === target)
  const past = (journals.data ?? []).filter((j) => j.targetSession !== target)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <form className="card tip-host" style={{ gap: 16 }} onSubmit={submit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="row">
              <h1>오늘 판단</h1>
              <Tip label="저널 기록 규칙">
                <span>정규장이 열리는 {open?.label ?? '—'} KST(09:30 ET)까지 고칠 수 있고, 그 뒤로는 잠깁니다.</span>
                <span>종목과 세션마다 한 건입니다. 같은 종목을 다시 저장하면 덮어씁니다.</span>
                <span>보합은 종가가 전일 종가의 ±0.15% 안에 머문다는 예상입니다. 그 안이면 적중으로 채점합니다.</span>
                <span>보류는 판단하지 않는다는 기록이라 채점하지 않습니다.</span>
                <span>메모는 500자까지.</span>
              </Tip>
            </div>
            <div className="sub">{target ? `${day(target)} 거래일 · ${open?.label} KST ${locked ? '마감됨' : '마감'}` : '발표된 거래일이 없습니다'}</div>
          </div>

          <div className="field">
            <label htmlFor="j-symbol" style={{ fontSize: 15 }}>종목</label>
            <input id="j-symbol" className="input" style={{ fontSize: 18, fontWeight: 700 }} type="text" required maxLength={16} autoComplete="off" autoCapitalize="characters"
              value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
            {metric && (
              <Link to={`/ticker/${metric.symbol}`} style={{ alignSelf: 'flex-start', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
                예상 범위 ${num(metric.dayRange.low)} – {num(metric.dayRange.high)} · 분석 보기
              </Link>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div id="j-dir-label" style={{ fontSize: 15, fontWeight: 600 }}>{day(target)} 종가는 전일 종가보다</div>
            <div role="group" aria-labelledby="j-dir-label" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {DIRS.map((d) => {
                const on = d.id === direction
                return (
                  <button key={d.id} type="button" aria-pressed={on} onClick={() => setDirection(d.id)}
                    style={{ minHeight: 56, borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--blue-weak)' : 'var(--line)', border: `2px solid ${on ? 'var(--blue)' : 'var(--line)'}` }}>
                    <span className={d.className} style={{ fontSize: 16, fontWeight: 700 }}>{d.label}</span>
                    <span className="small">{d.sub}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="field">
            <label htmlFor="j-memo" style={{ fontSize: 15 }}>한 줄 메모</label>
            <textarea id="j-memo" className="input" maxLength={500} rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          {saved && <p role="status" className="muted">저장했습니다.</p>}
          <button type="submit" className="btn" disabled={locked || !symbol.trim()}>{locked ? '마감됨' : '저장'}</button>
        </form>

        {todays.length > 0 && (
          <section className="card">
            <h2>오늘 저장한 판단</h2>
            {todays.map((j) => (
              <div key={j.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <div className="row"><b style={{ fontSize: 16 }}>{j.symbol}</b><b className={DIR_CLASS[j.direction]} style={{ fontSize: 15 }}>{DIR_TEXT[j.direction]}</b></div>
                  {j.memo && <div className="sub" style={{ fontSize: 15 }}>{j.memo}</div>}
                </div>
                {!locked && <button type="button" className="btn btn-weak" style={{ flex: 'none', height: 44, padding: '0 14px', fontSize: 15, fontWeight: 400 }} onClick={() => edit(j)}>수정</button>}
              </div>
            ))}
          </section>
        )}
      </div>

      <section className="card tip-host" style={{ paddingBottom: 4, gap: 4 }}>
        <div className="row" style={{ paddingBottom: 8 }}>
          <h2>지난 기록</h2>
          <Tip label="지난 기록 채점 방식">
            <span>마감 후에는 고칠 수 없고, 종가가 들어오면 자동으로 채점됩니다.</span>
            <span>실제 종가는 전일 종가 대비 수익률입니다. ±0.15% 안이면 보합으로 봅니다.</span>
            <span>보류로 남긴 날은 채점하지 않습니다.</span>
          </Tip>
        </div>
        {journals.error && <p className="err">{journals.error}</p>}
        {journals.data && past.length === 0 && <p className="muted" style={{ padding: '12px 0' }}>지난 기록이 없습니다.</p>}
        {past.map((j) => (
          <div key={`${j.symbol}${j.targetSession}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 88px', gap: '6px 8px', padding: '14px 0', borderTop: '1px solid var(--line)' }}>
            <div className="row" style={{ alignItems: 'baseline' }}><b style={{ fontSize: 16 }}>{j.symbol}</b><span className="muted">{day(j.targetSession)}</span></div>
            <div className="r" style={{ fontSize: 15 }}><Result e={j} /></div>
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, maxWidth: 340 }}>
              <div><div className="small">내 판단</div><b className={DIR_CLASS[j.direction]} style={{ fontSize: 16 }}>{DIR_TEXT[j.direction]}</b></div>
              <div><div className="small">실제 종가</div><b style={{ fontSize: 16 }}><ReturnText ret={j.actualReturn} /></b></div>
            </div>
            {j.memo && <div className="sub" style={{ gridColumn: '1 / -1', fontSize: 15 }}>{j.memo}</div>}
          </div>
        ))}
      </section>
    </div>
  )
}
