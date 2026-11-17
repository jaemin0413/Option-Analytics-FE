import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type EventItem, type Metric, type Range, type SignalItem } from '../api'
import { Tip } from '../components/Tip'
import { useLoad } from '../useLoad'
import { day, EVENT, gexBn, num, pct, REGIME, shortDay } from '../format'

const HYPOTHESES: Record<string, { title: string; rule: string }> = {
  'maxpain-pull-v1': {
    title: '맥스페인 당김',
    rule: '전일 종가가 맥스페인보다 예상 범위 폭의 0.25배 넘게 위에 있으면 하락, 그만큼 아래면 상승, 그 사이는 보류. 이 앱이 정한 규칙입니다.',
  },
  'pcr-contrarian-v1': {
    title: 'PCR 역발상',
    rule: '거래량 PCR의 1년 백분위가 90 이상이면 상승, 10 이하면 하락, 그 사이는 보류. 이 앱이 정한 규칙입니다.',
  },
}

const SIGNAL: Record<string, { label: string; className: string }> = {
  UP: { label: '▲ 상승', className: 'up' },
  DOWN: { label: '▼ 하락', className: 'down' },
  FLAT: { label: '보합', className: '' },
  ABSTAIN: { label: '판단 보류', className: 'muted' },
  NO_DATA: { label: '데이터 부족', className: 'warn' },
}

function SignalText({ s }: { s: SignalItem | undefined }) {
  const v = SIGNAL[s?.signal ?? 'NO_DATA'] ?? { label: s?.signal, className: '' }
  return <div className={v.className} style={{ fontSize: 15, fontWeight: 700 }}>{v.label}</div>
}

function RangePanel({ on, label, range, close, flag }: { on: boolean; label: string; range: Range; close: number | null; flag: string }) {
  return (
    <div className={on ? 'rg-panel on' : 'rg-panel'}>
      <div className="rg-label sub" style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>${num(range.low)} – {num(range.high)}</div>
      <div className="row" style={{ alignItems: 'baseline', gap: 10, fontSize: 16 }}>
        <span>±{close && range.width ? pct(range.width / close, 2) : '—'}</span>
        {flag && <span className="warn" style={{ fontSize: 14 }}>{flag}</span>}
      </div>
      <div aria-hidden="true" style={{ position: 'relative', height: 20, marginTop: 6 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 9, height: 2, background: 'var(--ink4)' }} />
        <div style={{ position: 'absolute', left: 0, top: 3, width: 2, height: 14, background: 'var(--ink3)' }} />
        <div style={{ position: 'absolute', right: 0, top: 3, width: 2, height: 14, background: 'var(--ink3)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 2, width: 16, height: 16, marginLeft: -8, borderRadius: 8, background: 'var(--blue)', border: '3px solid #fff' }} />
      </div>
      <div className="small" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}><span>하한</span><span>전일 종가 ${num(close)}</span><span className="r">상한</span></div>
    </div>
  )
}

// 행사가별 GEX 막대. 전일 종가 ±15% 안만 그린다
function StrikeChart({ m }: { m: Metric }) {
  const close = m.baseClose
  const byStrike = m.gex.byStrike
  if (!close || !byStrike) return <p className="muted">행사가별 데이터가 없습니다.</p>

  const rows = Object.entries(byStrike)
    .map(([strike, v]) => ({ strike: Number(strike), v }))
    .filter((r) => Math.abs(r.strike - close) / close <= 0.15)
    .sort((a, b) => b.strike - a.strike)
  const max = Math.max(...rows.map((r) => Math.abs(r.v)), 1)
  // 개별주는 행사가별 값이 작아서 십억 단위면 다 0.00이 된다
  const unit = max >= 1e9 ? { div: 1e9, label: '$bn', digits: 2 } : { div: 1e6, label: '$m', digits: 1 }
  const fmt = (v: number) => {
    const text = (v / unit.div).toFixed(unit.digits)
    return Number(text) === 0 ? (0).toFixed(unit.digits) : text
  }
  const tags: Record<number, string> = {}
  if (m.weekly.maxPain !== null) tags[m.weekly.maxPain] = '맥스페인'
  if (m.weekly.putWall !== null) tags[m.weekly.putWall] = '풋 집중'
  if (m.weekly.callWall !== null) tags[m.weekly.callWall] = '콜 집중'

  function Row({ strike, v }: { strike: number; v: number }) {
    const w = `${Math.round((Math.abs(v) / max) * 100)}%`
    const pos = v >= 0
    const tag = tags[strike] ?? ''
    return (
      <div className="strike-row">
        <span style={{ fontWeight: 600 }}>${strike}</span>
        <span className="strike-neg">
          <span style={{ fontWeight: 700, marginRight: 8 }}>{pos ? tag : ''}</span>
          <span aria-hidden="true" style={{ display: 'block', height: 18, borderRadius: '3px 0 0 3px', background: 'var(--blue)', width: pos ? 0 : w }} />
        </span>
        <span className="strike-pos">
          <span aria-hidden="true" style={{ display: 'block', height: 18, borderRadius: '0 3px 3px 0', background: 'var(--red)', width: pos ? w : 0 }} />
          <span style={{ fontWeight: 700, marginLeft: 8 }}>{pos ? '' : tag}</span>
        </span>
        <span className="r muted">{fmt(v)}</span>
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <div className="strike-row small" style={{ height: 'auto', paddingBottom: 6 }}><span>행사가</span><span className="r">− 풋 우세</span><span>콜 우세 +</span><span className="r">{unit.label}</span></div>
      {rows.filter((r) => r.strike > close).map((r) => <Row key={r.strike} {...r} />)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28, fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>
        <span aria-hidden="true" style={{ flex: 1, borderTop: '2px dashed var(--blue)' }} />
        <span>전일 종가 ${num(close)}</span>
        <span aria-hidden="true" style={{ flex: 1, borderTop: '2px dashed var(--blue)' }} />
      </div>
      {rows.filter((r) => r.strike <= close).map((r) => <Row key={r.strike} {...r} />)}
    </div>
  )
}

function eventFlag(events: EventItem[], from: string, to: string): string {
  const e = events.find((x) => x.date > from && x.date <= to)
  return e ? `${EVENT[e.type]} ${shortDay(e.date)} 포함` : ''
}

export function Ticker() {
  const { symbol = '' } = useParams()
  const { data, error } = useLoad(() => api.ticker(symbol), [symbol])
  const [tab, setTab] = useState<'day' | 'week'>('day')

  if (error) return <p className="err">{error}</p>
  if (!data) return <p className="muted">불러오는 중</p>
  const m = data.metric
  if (!m) return <><h1>{symbol.toUpperCase()}</h1><p className="muted">이 종목은 이번 발표에 결과가 없습니다.</p></>

  const range = tab === 'day' ? m.dayRange : m.weekRange
  const hypotheses = [...new Set(data.signals.map((s) => s.hypothesis))]

  return (
    <>
      <section className="tip-host" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
          <div className="row" style={{ alignItems: 'baseline', gap: 10, flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 32, lineHeight: 1.1 }}>{m.symbol}</h1>
            <span className="muted" style={{ fontSize: 16 }}>전일 종가 <b style={{ color: 'var(--ink)' }}>${num(m.baseClose)}</b></span>
          </div>
          <Link to={`/journal?symbol=${m.symbol}`} className="btn" style={{ flex: 'none', height: 44, padding: '0 16px', fontSize: 15 }}>판단 기록</Link>
        </div>
        <div className="row">
          <div className="sub">
            <div>가격 기준 <b style={{ fontWeight: 600, color: 'var(--ink)' }}>{day(m.baseSession)} 종가</b></div>
            <div>OI 기준 <b style={{ fontWeight: 600, color: 'var(--ink)' }}>{day(m.oiAsOfDate)}</b>{m.oiDelayDays ? ` · ${m.oiDelayDays}거래일 지연` : ''}</div>
          </div>
          <Tip label="데이터 기준">
            <span>{day(data.publication.baseSession)} 장 마감 후 발표분입니다.</span>
            <span>호가·체결은 Alpaca indicative 피드, IV·그릭스는 제공자 계산, 전일 마감 후 수집.</span>
            <span>OI는 하루 늦게 확정돼서 가격 기준일과 다릅니다.</span>
          </Tip>
        </div>
      </section>

      <section className="card tip-host" style={{ gap: 12 }}>
        <div className="row">
          <h2>예상 변동 범위</h2>
          <Tip label="예상 변동 범위 설명과 계산 기준">
            <span>옵션 가격에 담긴 변동성(IV)으로 계산한 1σ 범위입니다. 실제로 이 안에 들어온 비율은 검증에서 따로 봅니다.</span>
            <span>폭 = 전일 종가 × IV × √τ, τ = 거래일 수 ÷ 252</span>
            <span>IV {pct(range.iv)} ({shortDay(range.ivExpiry)} 만기 ATM{range.fallback ? ', 대체 만기' : ''}, 제공자 계산)</span>
            {m.dayRange.rvWidth !== null && <span>최근 20일 실제 변동으로 계산하면 다음 거래일 ±${num(m.dayRange.rvWidth)}, 이번 주 ±${num(m.weekRange.rvWidth)}입니다.</span>}
            <span>실적 발표가 기간 안에 있으면 범위 밖으로 나가는 일이 늘어납니다.</span>
            <span>모델 em-v1</span>
          </Tip>
        </div>
        <div className="seg rg-tabs" role="group" aria-label="예상 기간">
          <button type="button" aria-pressed={tab === 'day'} onClick={() => setTab('day')}>다음 거래일 {shortDay(m.targetSession)}</button>
          <button type="button" aria-pressed={tab === 'week'} onClick={() => setTab('week')}>이번 주 ~{shortDay(m.weekTargetSession)}</button>
        </div>
        <div className="rg-panels">
          <RangePanel on={tab === 'day'} label={`다음 거래일 · ${day(m.targetSession)} 종가까지`} range={m.dayRange} close={m.baseClose} flag={m.dayEvent ? eventFlag(data.events, m.baseSession, m.targetSession) || '이벤트 포함' : ''} />
          <RangePanel on={tab === 'week'} label={`이번 주 · ${day(m.weekTargetSession)} 종가까지`} range={m.weekRange} close={m.baseClose} flag={m.weekEvent ? eventFlag(data.events, m.baseSession, m.weekTargetSession) || '이벤트 포함' : ''} />
        </div>
      </section>

      <section className="card tip-host">
        <div className="row">
          <h2>변동 환경</h2>
          <Tip label="변동 환경(GEX 레짐) 설명과 계산 기준">
            <span>GEX는 딜러의 보유 방향을 가정하여 계산한 감마 노출 추정치입니다. 양수면 변동 억제, 음수면 증폭이라는 가설이고, 오를지 내릴지는 말하지 않습니다.</span>
            <span>단위는 십억 달러(주가 1%당). 이번 주 만기까지 {gexBn(m.gex.weekly)}, 월간 만기까지 {gexBn(m.gex.monthly)}, 전체 만기 {gexBn(m.gex.allExpiries)}(참고값)</span>
            <span>입력 품질: OI 가중 결측 {pct(m.gex.oiMissingRate)}, 계약 수 결측 {pct(m.gex.contractMissingRate)}({m.gex.contracts ?? '—'}계약 중), ATM ±2 행사가 {m.gex.atmMissing ? '결측 있음' : '결측 없음'}</span>
            <span>모델 gex-v1</span>
          </Tip>
        </div>
        <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
          <span className={m.gex.regime === 'NO_DATA' ? 'big warn' : 'big'}>{m.gex.regime === 'NO_DATA' ? '데이터 부족' : `변동 ${REGIME[m.gex.regime]}`}</span>
          <span className="sub" style={{ fontSize: 16 }}>GEX {gexBn(m.gex.weekly)}</span>
        </div>
        {m.gex.official ? <div className="muted">품질 기준 충족</div> : <div className="warn" style={{ fontSize: 14 }}>품질 미달</div>}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section className="card tip-host" style={{ flex: '999 1 520px', minWidth: 0, gap: 12 }}>
          <div className="row">
            <h2>집중 가격대</h2>
            <span className="muted">{shortDay(m.weekly.expiry)} 만기</span>
            <Tip label="집중 가격대 설명">
              <span>맥스페인은 만기 때 옵션 보유자 전체가 가장 적게 받는 행사가입니다. 주가가 끌린다는 것은 별도 가설입니다.</span>
              <span>콜·풋 집중은 콜 또는 풋의 GEX 기여가 가장 큰 행사가. 흔히 콜 월·풋 월이라 부르지만 저항·지지 여부는 검증 대상입니다.</span>
              <span>막대는 행사가별 GEX, 전일 종가 ±15% 안의 행사가만 그립니다.</span>
              {m.monthly.expiry && <span>{shortDay(m.monthly.expiry)} 월간 만기는 풋 집중 ${num(m.monthly.putWall, 0)}, 맥스페인 ${num(m.monthly.maxPain, 0)}, 콜 집중 ${num(m.monthly.callWall, 0)}</span>}
            </Tip>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <div><div className="muted">풋 집중</div><div className="big">${num(m.weekly.putWall, 0)}</div></div>
            <div><div className="muted">맥스페인</div><div className="big">${num(m.weekly.maxPain, 0)}</div></div>
            <div><div className="muted">콜 집중</div><div className="big">${num(m.weekly.callWall, 0)}</div></div>
          </div>
          <StrikeChart m={m} />
        </section>

        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="card tip-host">
            <div className="row">
              <h2>풋/콜 비율</h2>
              <Tip label="풋/콜 비율 설명">
                <span>풋 ÷ 콜. 거래량 기준과 OI 기준은 다른 값입니다. 풋 거래량이 많다고 하락 베팅이 많다고 단정할 수 없습니다.</span>
                <span>전 만기 합산 기준. 이번 주 만기만 보면 거래량 {num(m.pcr.volumeWeek)}, OI {num(m.pcr.openInterestWeek)}</span>
                <span>1년 백분위는 관측이 252거래일 쌓여야 계산합니다. 그 전에는 비율만 참고로 봅니다.</span>
                <span>모델 pcr-v1</span>
              </Tip>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <div><div className="muted">거래량</div><div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{num(m.pcr.volume)}</div></div>
              <div><div className="muted">OI</div><div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{num(m.pcr.openInterest)}</div></div>
            </div>
            <div className="muted">1년 백분위 {m.pcr.percentile === null ? <span className="warn">데이터 부족</span> : <b style={{ color: 'var(--ink)' }}>{Math.round(m.pcr.percentile)}</b>}</div>
          </section>

          <section className="card tip-host" aria-labelledby="hyp-h" style={{ paddingBottom: 4, gap: 4 }}>
            <div className="row" style={{ paddingBottom: 6 }}>
              <h2 id="hyp-h">방향 가설</h2>
              <Tip label="방향 가설 설명">
                <span>방향을 실제로 주장하는 가설만 나란히 둡니다. 다수결로 합치지 않습니다.</span>
                <span>판단 보류는 신호가 없다는 뜻, 데이터 부족은 계산 조건을 못 채웠다는 뜻입니다.</span>
              </Tip>
            </div>
            <div className="small" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 88px 88px', gap: 8, paddingBottom: 6 }}><span>가설</span><span>다음 거래일</span><span>이번 주</span></div>
            {hypotheses.length === 0 && <p className="muted" style={{ padding: '12px 0' }}>신호가 없습니다.</p>}
            {hypotheses.map((h) => {
              const info = HYPOTHESES[h]
              return (
                <div key={h} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 88px 88px', gap: 8, alignItems: 'center', minHeight: 52, borderTop: '1px solid var(--line)' }}>
                  <div className="row" style={{ minWidth: 0, flexWrap: 'nowrap' }}>
                    <span style={{ fontWeight: 700 }}>{info?.title ?? h}</span>
                    {info && <Tip label="가설 규칙"><span>{info.rule}</span><span>{h}</span></Tip>}
                  </div>
                  <SignalText s={data.signals.find((s) => s.hypothesis === h && s.horizon === 'NEXT_DAY')} />
                  <SignalText s={data.signals.find((s) => s.hypothesis === h && s.horizon === 'WEEK')} />
                </div>
              )
            })}
            <Link to="/hit-rates" style={{ minHeight: 44, display: 'flex', alignItems: 'center', fontWeight: 600, borderTop: '1px solid var(--line)' }}>검증에서 성적 보기</Link>
          </section>
        </div>
      </div>
    </>
  )
}
