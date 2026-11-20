// 백엔드 응답 타입은 v1 DTO 이름 그대로 둔다
export type Range = { iv: number | null; ivExpiry: string | null; fallback: boolean | null; width: number | null; low: number | null; high: number | null; rvWidth: number | null }
export type Concentration = { expiry: string | null; maxPain: number | null; callWall: number | null; putWall: number | null }
export type Gex = {
  weekly: number | null; monthly: number | null; allExpiries: number | null
  regime: 'DAMPENING' | 'AMPLIFYING' | 'NO_DATA'; official: boolean
  contracts: number | null; contractMissingRate: number | null; oiMissingRate: number | null; atmMissing: boolean | null
  byStrike: Record<string, number> | null
}
export type Pcr = { volume: number | null; openInterest: number | null; volumeWeek: number | null; openInterestWeek: number | null; percentile: number | null }
export type Metric = {
  symbol: string; baseSession: string; targetSession: string; weekTargetSession: string
  baseClose: number | null; oiAsOfDate: string | null; oiDelayDays: number | null
  dayRange: Range; weekRange: Range; weekly: Concentration; monthly: Concentration
  gex: Gex; pcr: Pcr; dayEvent: boolean; weekEvent: boolean
}
export type Publication = { publicationId: number; baseSession: string; publishedAt: string | null; modelVersion: string }
export type EventItem = { date: string; type: 'EARNINGS' | 'FOMC' | 'CPI' | 'JOBS'; symbol: string | null; title: string | null }
export type SentimentComponent = { name: string; value: number | null; percentile: number | null; asOf: string | null; used: boolean }
export type Dashboard = {
  publication: Publication | null
  indexCards: Metric[]
  sectors: Metric[]
  sentiment: { score: number | null; usedCount: number; usedBitset: number; components: SentimentComponent[] } | null
  events: EventItem[]
}
export type SignalItem = { hypothesis: string; horizon: 'NEXT_DAY' | 'WEEK'; targetSession: string; signal: string; inputValue: number | null }
export type TickerDetail = { publication: Publication; metric: Metric | null; signals: SignalItem[]; events: EventItem[] }
export type HitRateRow = {
  subject: string; horizon: string; ivSource: string; regime: string | null; startDate: string
  total: number; scored: number; hits: number; up: number; upHits: number; down: number; downHits: number
  abstain: number; noData: number
  avgWidth: number | null; avgOutsideError: number | null; avgDistance: number | null; avgAbsReturn: number | null; avgRangePct: number | null
  hitRate: number | null; signalRate: number | null; abstainRate: number | null; missingRate: number | null
}
export type HitRates = { all: HitRateRow[]; excludingEvents: HitRateRow[] }
export type DailyRow = { targetSession: string; horizon: string; scored: number; hits: number }
export type Direction = 'UP' | 'DOWN' | 'FLAT' | 'HOLD'
export type JournalEntry = { symbol: string; targetSession: string; direction: Direction; memo: string | null; hit: boolean | null; actualReturn: number | null }

export class ApiError extends Error {
  status: number
  code: string | undefined
  constructor(status: number, code: string | undefined, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const ACCESS = 'accessToken'
const REFRESH = 'refreshToken'

// shortcut: 토큰을 localStorage에 둔다. XSS에 약하니 배포 전에 httpOnly 쿠키로 바꿀지 정한다
export const tokens = {
  access: () => localStorage.getItem(ACCESS),
  refresh: () => localStorage.getItem(REFRESH),
  save(t: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS, t.accessToken)
    localStorage.setItem(REFRESH, t.refreshToken)
  },
  clear() {
    localStorage.removeItem(ACCESS)
    localStorage.removeItem(REFRESH)
  },
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const access = tokens.access()
  if (access) headers.Authorization = `Bearer ${access}`

  let res: Response
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, undefined, '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.')
  }
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const error = json?.error
    throw new ApiError(res.status, error?.code, error?.message ?? `요청 실패 (${res.status})`)
  }
  return json?.data as T
}

let reissuing: Promise<boolean> | null = null

// 액세스 토큰이 만료되면 리프레시 토큰으로 한 번만 다시 받는다
async function reissue(): Promise<boolean> {
  const refreshToken = tokens.refresh()
  if (!refreshToken) return false
  const run = async () => {
    // 기다리는 동안 다른 탭이 먼저 다시 받았으면 그 토큰을 쓴다
    if (tokens.refresh() !== refreshToken) return tokens.refresh() !== null
    try {
      tokens.save(await send('POST', '/api/auth/reissue', { refreshToken }))
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) throw e
      tokens.clear()
      return false
    }
  }
  // 백엔드는 사용자당 리프레시 토큰 하나를 돌려 써서, 탭 둘이 동시에 다시 받으면 늦은 쪽이 실패한다
  return navigator.locks ? navigator.locks.request('option-reissue', run) : run()
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  try {
    return await send<T>(method, path, body)
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e
    reissuing ??= reissue().finally(() => { reissuing = null })
    if (!(await reissuing)) {
      const next = window.location.pathname.slice(import.meta.env.BASE_URL.length - 1) + window.location.search
      window.location.href = `${import.meta.env.BASE_URL}login${next === '/' ? '' : `?next=${encodeURIComponent(next)}`}`
      throw e
    }
    return send<T>(method, path, body)
  }
}

export const api = {
  login: (email: string, password: string) => send<{ accessToken: string; refreshToken: string }>('POST', '/api/auth/login', { email, password }),
  signUp: (email: string, password: string) => send<void>('POST', '/api/auth/sign-up', { email, password }),
  logout: () => request<void>('POST', '/api/auth/logout'),
  withdraw: () => request<void>('DELETE', '/api/auth/withdraw'),
  dashboard: () => request<Dashboard>('GET', '/api/dashboard'),
  search: (q: string) => request<{ symbol: string; name: string | null }[]>('GET', `/api/tickers?q=${encodeURIComponent(q)}`),
  ticker: (symbol: string) => request<TickerDetail>('GET', `/api/tickers/${encodeURIComponent(symbol)}`),
  hitRates: (group: string, weekday: string) => {
    const params = new URLSearchParams()
    if (group) params.set('group', group)
    if (weekday) params.set('issuedWeekday', weekday)
    return request<HitRates>('GET', `/api/hit-rates?${params}`)
  },
  daily: (subject: string) => request<DailyRow[]>('GET', `/api/hit-rates/daily?subject=${encodeURIComponent(subject)}`),
  journals: () => request<JournalEntry[]>('GET', '/api/journals?limit=50'),
  saveJournal: (entry: { symbol: string; targetSession: string; direction: Direction; memo: string }) =>
    request<JournalEntry>('PUT', '/api/journals', entry),
}
