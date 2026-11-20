import { Link } from 'react-router-dom'
import { api, type EventItem, type Metric } from '../api'
import { Tip } from '../components/Tip'
import { useLoad } from '../useLoad'
import { day, EVENT, gexBn, marketOpenKst, num, pct, REGIME, SECTOR_NAME, SENTIMENT, shortDay } from '../format'

function kst(instant: string | null): string {
  if (!instant) return ''
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant))
}

// 같은 날 같은 종류 일정은 한 줄로 묶는다. 실적은 심볼, 나머지는 제목
function groupEvents(events: EventItem[]) {
  const rows = new Map<string, { date: string; type: string; text: string[] }>()
  for (const e of events) {
    const key = `${e.date}|${e.type}`
    const row = rows.get(key) ?? { date: e.date, type: e.type, text: [] }
    row.text.push(e.symbol ?? e.title ?? EVENT[e.type])
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function IndexCard({ m }: { m: Metric }) {
  const ok = m.gex.official
  return (
    <Link className="ix-item" to={`/ticker/${m.symbol}`}>
      <span style={{ display: 'block' }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>{m.symbol}</span>
        <span className="small" style={{ display: 'block' }}><span className="ix-wide">전일 종가 </span>${num(m.baseClose)}</span>
      </span>
      <span style={{ display: 'block' }}>
        <span className="ix-range" style={{ display: 'block' }}>{num(m.dayRange.low)} – {num(m.dayRange.high)}</span>
        <span className="muted" style={{ display: 'block' }}><span className="ix-wide">전일 종가 대비 </span>±{m.baseClose && m.dayRange.width ? pct(m.dayRange.width / m.baseClose, 2) : '—'}</span>
      </span>
      <span className="ix-state" style={{ display: 'block' }}>
        <span style={{ display: 'block', fontWeight: 600 }}>{REGIME[m.gex.regime]}<span className="ix-wide" style={{ fontWeight: 400, color: 'var(--ink3)' }}> · GEX {gexBn(m.gex.weekly)}</span></span>
        {ok ? <span className="ix-wideb small">품질 기준 충족</span> : <span className="warn" style={{ display: 'block', fontSize: 13 }}>품질 미달</span>}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: 'var(--blue)' }}>
        <span className="ix-wide">분석 보기</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </span>
    </Link>
  )
}

export function Dashboard() {
  const { data, error } = useLoad(api.dashboard, [])
  const title = <title>대시보드 · Option</title>

  if (error) return <>{title}<p className="err">{error}</p></>
  if (!data) return <>{title}<p className="muted">불러오는 중</p></>
  if (!data.publication) return <>{title}<p className="muted">아직 발표된 결과가 없습니다.</p></>

  const first = data.indexCards[0] ?? data.sectors[0]
  const sentiment = data.sentiment
  const missing = sentiment ? sentiment.components.filter((c) => !c.used).map((c) => SENTIMENT[c.name] ?? c.name) : []
  const events = groupEvents(data.events)
  const today = first?.targetSession
  const opened = today ? Date.now() >= marketOpenKst(today).at.getTime() : false

  return (
    <>
      {title}
      <section className="tip-host" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="row">
          <h1>{day(today)} 장 전</h1>
          <Tip label="이 화면의 데이터 기준">
            <span>{day(data.publication.baseSession)} {kst(data.publication.publishedAt)} KST 발표분입니다.</span>
            <span>입력은 indicative 피드, IV·그릭스는 제공자 계산, 전일 마감 후 수집.</span>
            <span>방향을 하나로 합친 종합 신호는 없습니다.</span>
          </Tip>
        </div>
        {first && <div className="sub">가격 기준 {day(first.baseSession)} 종가 · OI 기준 {day(first.oiAsOfDate)}</div>}
        {opened && <div className="warn" style={{ fontSize: 14 }}>이 세션은 이미 열렸습니다. 다음 발표 전까지 같은 내용이 보입니다.</div>}
      </section>

      <section className="tip-host" aria-labelledby="idx-h" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row">
          <h2 id="idx-h">지수 ETF</h2>
          <span className="muted">{day(today)} 종가 예상 범위</span>
          <Tip label="지수 ETF 표 읽는 법">
            <span>예상 범위는 옵션 가격에서 계산한 1σ 범위입니다. 가격 단위는 USD.</span>
            <span>억제는 변동이 눌리는 환경, 증폭은 커지는 환경이라는 가설입니다. 방향은 말하지 않습니다.</span>
            <span>"품질 미달"은 입력 결측이 많아 참고값으로만 본다는 뜻입니다.</span>
          </Tip>
        </div>
        <div className="ix-wrap">
          <div className="ix-head"><span>전일 종가</span><span>범위 · 종가 대비</span><span className="r">GEX</span><span /></div>
          {data.indexCards.map((m) => <IndexCard key={m.symbol} m={m} />)}
        </div>
      </section>

      <div className="grid-auto">
        <section className="card tip-host">
          <div className="row">
            <h2>이번 주 일정</h2>
            <Tip label="일정이 성적에 주는 영향">
              <span>실적일과 FOMC·CPI·고용 발표일을 보여줍니다.</span>
              <span>이벤트가 낀 날의 성적은 검증에서 포함·제외를 나눠 봅니다.</span>
            </Tip>
          </div>
          <div>
            {events.length === 0 && <div className="muted" style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>일정 없음</div>}
            {events.map((e) => (
              <div key={`${e.date}${e.type}`} className="tr" style={{ gridTemplateColumns: '84px 44px minmax(0, 1fr)', minHeight: 40 }}>
                <span>{day(e.date)}</span>
                <span className="small">{EVENT[e.type]}</span>
                <span style={{ fontWeight: 600 }}>{e.text.join(' · ')}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card tip-host" style={{ paddingBottom: 4, gap: 10 }}>
          <div className="row">
            <h2>시장심리</h2>
            <Tip label="시장심리 지수 설명">
              <span>CNN 공포탐욕의 7개 구성요소를 근사한 자체 지수라 CNN과 숫자가 다릅니다. 높을수록 탐욕.</span>
              {missing.length > 0 && <span>오늘은 {missing.join(', ')}이(가) 기준일이 3거래일 넘게 지나 빠졌습니다. {sentiment!.usedCount}/7 값은 7/7 값과 같은 지수로 비교하지 않습니다.</span>}
              <span>모델 sent-v1</span>
            </Tip>
          </div>
          {sentiment && sentiment.score !== null ? (
            <>
              <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{Math.round(sentiment.score)}</span>
                <span className="muted" style={{ fontSize: 15 }}>/ 100</span>
                {sentiment.usedCount < 7 && <span className="warn" style={{ fontSize: 14 }}>구성 {sentiment.usedCount}/7</span>}
              </div>
              <div>
                <div role="img" aria-label={`시장심리 ${Math.round(sentiment.score)}. 0은 공포, 100은 탐욕`} style={{ position: 'relative', height: 20 }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 4, background: 'var(--line)', borderRadius: 2 }} />
                  <div style={{ position: 'absolute', left: `${sentiment.score}%`, top: 1, width: 4, height: 18, marginLeft: -2, background: 'var(--ink)', borderRadius: 2 }} />
                </div>
                <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}><span>0 공포</span><span>50</span><span>탐욕 100</span></div>
              </div>
              <details>
                <summary style={{ listStyle: 'none', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600, color: 'var(--blue)' }}>구성요소 보기</summary>
                <div style={{ paddingBottom: 12 }}>
                  <div className="small" style={{ display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr) 40px 48px', gap: 8, paddingBottom: 4 }}><span>구성요소</span><span>3년 백분위</span><span /><span className="r">기준일</span></div>
                  {sentiment.components.map((c) => (
                    <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr) 40px 48px', gap: 8, alignItems: 'center', minHeight: 34, fontSize: 14 }}>
                      <span>{SENTIMENT[c.name] ?? c.name}</span>
                      <span className="bar" aria-hidden="true"><span style={{ width: c.used && c.percentile !== null ? `${c.percentile}%` : 0 }} /></span>
                      <span className="r" style={{ fontWeight: 600 }}>{c.used && c.percentile !== null ? Math.round(c.percentile) : '제외'}</span>
                      <span className="small r">{shortDay(c.asOf)}</span>
                    </div>
                  ))}
                </div>
              </details>
            </>
          ) : (
            <p className="warn">데이터 부족</p>
          )}
        </section>
      </div>

      <section className="card tip-host">
        <div className="row">
          <h2>섹터 ETF</h2>
          <span className="muted">예상 범위 폭</span>
          <Tip label="섹터 ETF 표 읽는 법">
            <span>전일 종가 대비 1σ 예상 폭입니다. 이번 주는 금요일 종가까지.</span>
            <span>GEX 열은 변동이 눌리는 환경(억제)인지 커지는 환경(증폭)인지입니다.</span>
          </Tip>
        </div>
        <div>
          <div className="tr th" style={{ gridTemplateColumns: 'minmax(96px, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) 80px' }}><span>섹터</span><span className="r">다음 거래일</span><span className="r">이번 주</span><span className="r">GEX</span></div>
          {data.sectors.map((s) => {
            const noData = s.gex.regime === 'NO_DATA'
            return (
              <Link key={s.symbol} to={`/ticker/${s.symbol}`} className="tr" style={{ gridTemplateColumns: 'minmax(96px, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) 80px' }}>
                <span style={{ lineHeight: 1.3 }}>
                  <span style={{ display: 'block', fontWeight: 700 }}>{SECTOR_NAME[s.symbol] ?? s.symbol}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--ink3)' }}>{s.symbol}</span>
                </span>
                <span className="r" style={{ fontWeight: 600 }}>±{s.baseClose && s.dayRange.width ? pct(s.dayRange.width / s.baseClose, 2) : '—'}</span>
                <span className="r muted" style={{ fontSize: 15 }}>±{s.baseClose && s.weekRange.width ? pct(s.weekRange.width / s.baseClose, 2) : '—'}</span>
                <span className={noData ? 'r warn' : 'r'} style={{ fontSize: 14 }}>{REGIME[s.gex.regime]}</span>
              </Link>
            )
          })}
        </div>
      </section>
    </>
  )
}
