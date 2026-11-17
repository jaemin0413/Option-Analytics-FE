import { useState } from 'react'
import { api, type HitRateRow } from '../api'
import { Tip } from '../components/Tip'
import { useLoad } from '../useLoad'
import { day, pct } from '../format'

// 채점 30건 미만은 표본 적음. PLAN에 없는 규칙이라 바뀔 수 있다
const SMALL_SAMPLE = 30

type Subject = { id: string; group: string; title: string; tip: string }

const DIRECTION: Subject[] = [
  { id: 'pcr-contrarian-v1', group: '가설', title: 'PCR 역발상', tip: '거래량 PCR의 1년 백분위가 90 이상이면 상승, 10 이하면 하락. SPY·QQQ는 백필 구간 포함.' },
  { id: 'maxpain-pull-v1', group: '가설', title: '맥스페인 당김', tip: '전일 종가가 맥스페인보다 충분히 위면 하락, 아래면 상승. 과거 OI가 없어 수집 시작 이후만 평가합니다.' },
  { id: 'baseline-always-up', group: '기준선', title: '항상 상승', tip: '매일 상승이라고만 답했을 때의 성적입니다. 가설이 이보다 낮으면 쓸모가 없습니다.' },
  { id: 'baseline-prev-direction', group: '기준선', title: '전일 방향 유지', tip: '어제 오른 날은 상승, 내린 날은 하락이라고 답했을 때의 성적입니다.' },
  { id: 'journal', group: '내 기록', title: '내 저널', tip: '모델을 참고한 내 최종 판단입니다. 보류는 채점하지 않습니다.' },
]
const RANGE: Subject[] = [
  { id: 'em-range', group: '모델', title: '예상 범위', tip: '' },
  { id: 'rv-range', group: '기준선', title: '실제 변동 범위', tip: '' },
]
const MAXPAIN = [
  { id: 'maxpain', title: '맥스페인' },
  { id: 'maxpain-base-spot', title: '예측 당시 현재가' },
  { id: 'maxpain-base-strike', title: '최근접 행사가' },
]
const HORIZON: Record<string, string> = { NEXT_DAY: '다음 거래일', WEEK: '이번 주' }
const GROUPS = [['', '전체'], ['INDEX_ETF', '지수 ETF'], ['SECTOR_ETF', '섹터 ETF'], ['OTHER_ETF', '기타 ETF'], ['STOCK', '개별주']]
const WEEKDAYS = [['', '전체'], ['1', '월'], ['2', '화'], ['3', '수'], ['4', '목'], ['5', '금']]

const key = (r: HitRateRow) => `${r.subject}|${r.horizon}|${r.ivSource}|${r.regime}`

function Rate({ r }: { r: HitRateRow | undefined }) {
  if (!r) return <div>—</div>
  return (
    <div>
      <div><span style={{ fontSize: 20, fontWeight: 700 }}>{pct(r.hitRate)}</span> <span style={{ fontSize: 14, fontWeight: 600 }}>{r.hits.toLocaleString()}/{r.scored.toLocaleString()}건</span></div>
      {r.scored < SMALL_SAMPLE && <div className="warn" style={{ fontSize: 13 }}>표본 적음</div>}
    </div>
  )
}

function Table({ subjects, all, ex, head, meta }: {
  subjects: Subject[]
  all: HitRateRow[]
  ex: HitRateRow[]
  head: string[]
  meta: (r: HitRateRow) => string
}) {
  const exByKey = new Map(ex.map((r) => [key(r), r]))
  let lastGroup = ''
  return (
    <div>
      <div className="hr-head"><span>{head[0]}</span><span className="hr-start">평가 시작</span><span className="hr-num col-all">전체</span><span className="hr-num col-ex">이벤트 제외</span><span className="hr-meta">{head[1]}</span></div>
      {subjects.flatMap((s) => all.filter((r) => r.subject === s.id).map((r) => {
        const group = s.group === lastGroup ? '' : s.group
        lastGroup = s.group
        const horizon = `${r.ivSource === 'BACKFILL' ? '백필 IV · ' : ''}${HORIZON[r.horizon] ?? r.horizon}`
        return (
          <div key={key(r)} className="hr-row">
            <div className="hr-group">{group}</div>
            <div>
              <div className="row">
                <span style={{ fontSize: 16, fontWeight: 700 }}>{s.title}</span>
                {s.tip && <Tip label="대상 설명"><span>{s.tip}</span><span>{s.id}</span></Tip>}
              </div>
              <div className="muted">{horizon}</div>
            </div>
            <div className="hr-start">{r.startDate}부터</div>
            <div className="hr-num col-all"><Rate r={r} /></div>
            <div className="hr-num col-ex"><Rate r={exByKey.get(key(r))} /></div>
            <div className="hr-meta">{meta(r)}</div>
          </div>
        )
      }))}
      {all.length === 0 && <p className="muted" style={{ padding: '12px 0' }}>아직 채점된 결과가 없습니다.</p>}
    </div>
  )
}

function Daily() {
  const [subject, setSubject] = useState(DIRECTION[0].id)
  const { data } = useLoad(() => api.daily(subject), [subject])
  const rows = (data ?? []).filter((r) => r.horizon === 'NEXT_DAY').sort((a, b) => b.targetSession.localeCompare(a.targetSession)).slice(0, 20)

  return (
    <section className="card tip-host" style={{ maxWidth: 560 }}>
      <div className="row">
        <h2>날짜별</h2>
        <Tip label="날짜별로 보는 이유"><span>같은 날 여러 종목의 결과는 서로 독립이 아닙니다. 종목 수가 아니라 날짜 수로도 보려고 둔 표입니다.</span></Tip>
      </div>
      <select className="select" aria-label="날짜별로 볼 대상" value={subject} onChange={(e) => setSubject(e.target.value)}>
        {DIRECTION.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
      <div>
        <div className="tr th" style={{ gridTemplateColumns: '84px minmax(0, 1fr) 64px' }}><span>대상 세션</span><span>적중 비율</span><span className="r">적중/채점</span></div>
        {rows.map((r) => (
          <div key={r.targetSession} className="tr" style={{ gridTemplateColumns: '84px minmax(0, 1fr) 64px', minHeight: 40 }}>
            <span>{day(r.targetSession)}</span>
            <span className="bar" aria-hidden="true" style={r.scored ? undefined : { background: 'transparent' }}><span style={{ width: r.scored ? `${(r.hits / r.scored) * 100}%` : 0 }} /></span>
            <span className="r" style={{ fontWeight: 600 }}>{r.scored ? `${r.hits} / ${r.scored}` : '—'}</span>
          </div>
        ))}
        {data && rows.length === 0 && <p className="muted" style={{ padding: '12px 0' }}>기록이 없습니다.</p>}
      </div>
    </section>
  )
}

export function HitRate() {
  const [tab, setTab] = useState<'dir' | 'range' | 'regime'>('dir')
  const [ev, setEv] = useState<'all' | 'ex'>('all')
  const [group, setGroup] = useState('')
  const [weekday, setWeekday] = useState('')
  const { data, error } = useLoad(() => api.hitRates(group, weekday), [group, weekday])

  const rows = data ? (ev === 'all' ? data.all : data.excludingEvents) : []
  const regimeRows = rows.filter((r) => r.subject === 'gex-regime' && r.horizon === 'NEXT_DAY')
  const maxpainRows = MAXPAIN.map((s) => ({ ...s, r: rows.find((r) => r.subject === s.id) }))
  const since = (list: (HitRateRow | undefined)[]) => list.map((r) => r?.startDate).filter(Boolean).sort()[0]

  return (
    <>
      <section className="tip-host" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row">
          <h1>검증</h1>
          <Tip label="검증 화면 읽는 법">
            <span>장 전에 낸 판단이 그날 종가에서 맞았는지 봅니다.</span>
            <span>대상마다 평가를 시작한 날이 다릅니다. 기간이 다른 줄끼리는 우열을 바로 견주기 어렵습니다.</span>
            <span>채점이 {SMALL_SAMPLE}건에 못 미치면 "표본 적음"으로 표시합니다.</span>
            <span>신호는 방향을 낸 비율, 기권은 판단 보류, 결측은 데이터 부족 비율입니다.</span>
          </Tip>
        </div>
        <div className="seg" role="group" aria-label="검증 종류" style={{ maxWidth: 520 }}>
          <button type="button" aria-pressed={tab === 'dir'} onClick={() => setTab('dir')}>방향</button>
          <button type="button" aria-pressed={tab === 'range'} onClick={() => setTab('range')}>범위</button>
          <button type="button" aria-pressed={tab === 'regime'} onClick={() => setTab('regime')}>레짐·가격대</button>
        </div>
        <div className="row" style={{ gap: '8px 12px', alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: '1 1 150px', maxWidth: 260, gap: 4 }}>
            <label htmlFor="f-group" className="muted" style={{ fontWeight: 400 }}>종목 그룹</label>
            <select id="f-group" className="select" value={group} onChange={(e) => setGroup(e.target.value)}>
              {GROUPS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 150px', maxWidth: 260, gap: 4 }}>
            <label htmlFor="f-weekday" className="muted" style={{ fontWeight: 400 }}>예측을 낸 요일</label>
            <select id="f-weekday" className="select" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {WEEKDAYS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className={tab === 'regime' ? 'seg' : 'seg ev-toggle'} role="group" aria-label="이벤트일 포함 여부">
          <button type="button" aria-pressed={ev === 'all'} onClick={() => setEv('all')}>전체</button>
          <button type="button" aria-pressed={ev === 'ex'} onClick={() => setEv('ex')}>이벤트일 제외</button>
        </div>
      </section>

      {error && <p className="err">{error}</p>}
      {!data && !error && <p className="muted">불러오는 중</p>}

      {data && (
        <div className={ev === 'all' ? 'ev-all' : 'ev-ex'} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'dir' && (
            <>
              <section className="card tip-host" aria-label="방향 성적" style={{ paddingBottom: 4 }}>
                <h2>방향 적중률</h2>
                <Table subjects={DIRECTION} all={data.all} ex={data.excludingEvents} head={['대상', '신호 · 기권 · 결측']}
                  meta={(r) => `신호 ${pct(r.signalRate)} · 기권 ${pct(r.abstainRate)} · 결측 ${pct(r.missingRate)}`} />
              </section>
              <Daily />
            </>
          )}

          {tab === 'range' && (
            <section className="card tip-host" aria-label="범위 성적" style={{ paddingBottom: 4 }}>
              <div className="row">
                <h2>범위 포함률</h2>
                <Tip label="범위 포함률 설명">
                  <span>종가가 예상 범위 안에 들어온 비율입니다. 68%와 다른 것은 오류 판정 근거가 아닙니다.</span>
                  <span>제공자 IV와 앱이 역산한 백필 IV 성적은 섞지 않습니다.</span>
                  <span>밖 오차는 범위를 벗어났을 때 벗어난 정도의 평균입니다.</span>
                </Tip>
              </div>
              <Table subjects={RANGE} all={data.all} ex={data.excludingEvents} head={['범위', '평균 폭 · 밖 오차']}
                meta={(r) => `평균 폭 ${r.avgWidth === null ? '—' : `±${pct(r.avgWidth, 2)}`} · 밖 오차 ${pct(r.avgOutsideError, 2)}${r.noData ? ` · 결측 ${pct(r.missingRate)}` : ''}`} />
            </section>
          )}

          {tab === 'regime' && (
            <div className="grid-auto">
              <section className="card tip-host">
                <div className="row">
                  <h2>레짐별 다음 날 움직임</h2>
                  <Tip label="레짐별 움직임 설명">
                    <span>GEX 레짐이 억제였던 날과 증폭이었던 날, 다음 거래일에 실제로 얼마나 움직였는지 평균입니다.</span>
                    <span>절대수익률은 종가 변화의 크기, 고저폭은 장중 고가와 저가의 차이입니다. 인과를 주장하지 않습니다.</span>
                  </Tip>
                </div>
                <SinceLine since={since(regimeRows)} small={regimeRows.reduce((n, r) => n + r.total, 0) < SMALL_SAMPLE} />
                <div>
                  <div className="tr th" style={{ gridTemplateColumns: 'minmax(0, 1fr) 44px 84px 68px' }}><span>레짐</span><span className="r">건수</span><span className="r">절대수익률</span><span className="r">고저폭</span></div>
                  {(['POSITIVE', 'NEGATIVE', 'NO_DATA'] as const).map((g) => {
                    const r = regimeRows.find((x) => x.regime === g)
                    const label = { POSITIVE: '억제', NEGATIVE: '증폭', NO_DATA: '데이터 부족' }[g]
                    return (
                      <div key={g} className="tr" style={{ gridTemplateColumns: 'minmax(0, 1fr) 44px 84px 68px' }}>
                        <span style={g === 'NO_DATA' ? { color: 'var(--ink3)' } : { fontWeight: 700 }}>{label}</span>
                        <span className="r">{r?.total ?? 0}</span>
                        <span className="r" style={{ fontWeight: 700 }}>{r?.avgAbsReturn != null ? pct(r.avgAbsReturn, 2) : '없음'}</span>
                        <span className="r" style={{ fontWeight: 700 }}>{r?.avgRangePct != null ? pct(r.avgRangePct, 2) : '없음'}</span>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="card tip-host">
                <div className="row">
                  <h2>맥스페인과 만기 종가의 거리</h2>
                  <Tip label="맥스페인 거리 설명">
                    <span>예측 시점의 맥스페인과 만기일 종가가 얼마나 떨어져 있었는지입니다. 짧을수록 가깝게 맞힌 것입니다.</span>
                    <span>기준선 둘(예측 당시 현재가, 가장 가까운 행사가)보다 짧아야 의미가 있습니다.</span>
                  </Tip>
                </div>
                <SinceLine since={since(maxpainRows.map((x) => x.r))} small={(maxpainRows[0].r?.total ?? 0) < SMALL_SAMPLE} />
                <div>
                  <div className="tr th" style={{ gridTemplateColumns: 'minmax(0, 1fr) 44px 76px' }}><span>기준</span><span className="r">건수</span><span className="r">평균 거리</span></div>
                  {maxpainRows.map(({ id, title, r }, i) => (
                    <div key={id} className="tr" style={{ gridTemplateColumns: 'minmax(0, 1fr) 44px 76px' }}>
                      <span style={i === 0 ? { fontWeight: 700 } : undefined}>{title}</span>
                      <span className="r">{r?.total ?? 0}</span>
                      <span className="r" style={{ fontWeight: 700 }}>{r?.avgDistance != null ? pct(r.avgDistance, 2) : '없음'}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function SinceLine({ since, small }: { since: string | undefined; small: boolean }) {
  if (!since) return <div className="sub">아직 채점된 결과가 없습니다.</div>
  return <div className="sub">{since}부터 {small && <span className="warn">표본 적음</span>}</div>
}
