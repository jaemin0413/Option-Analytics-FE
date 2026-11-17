const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// '2026-11-16' -> '11-16(월)'
export function day(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${iso.slice(5)}(${weekday})`
}

export function shortDay(iso: string | null | undefined): string {
  return iso ? iso.slice(5) : '—'
}

export function num(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// 0.0123 -> '1.23%'
export function pct(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined) return '—'
  return `${(ratio * 100).toFixed(digits)}%`
}

export function signed(v: number, digits = 2): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`
}

// GEX는 달러 단위라 십억으로 나눠 보여준다
export function gexBn(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${signed(v / 1e9)}bn`
}

export const REGIME: Record<string, string> = { DAMPENING: '억제', AMPLIFYING: '증폭', NO_DATA: '데이터 부족' }

export const EVENT: Record<string, string> = { EARNINGS: '실적', FOMC: 'FOMC', CPI: 'CPI', JOBS: '고용' }

export const SENTIMENT: Record<string, string> = {
  momentum: '모멘텀',
  strength: '주가 강도',
  breadth: '등락 폭',
  putCall: '풋/콜',
  junkBond: '정크본드 수요',
  volatility: '변동성',
  safeHaven: '안전자산 수요',
}

export const SECTOR_NAME: Record<string, string> = {
  XLK: '기술', XLF: '금융', XLV: '헬스케어', XLY: '경기소비재', XLP: '필수소비재', XLE: '에너지',
  XLI: '산업재', XLB: '소재', XLU: '유틸리티', XLRE: '부동산', XLC: '커뮤니케이션',
}

// 정규장 시작(09:30 ET)을 KST로. 서머타임이면 22:30, 아니면 23:30
export function marketOpenKst(iso: string): { at: Date; label: string } {
  const [y, m, d] = iso.split('-').map(Number)
  let at = new Date(Date.UTC(y, m - 1, d, 13, 30))
  const etHour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(at)
  if (etHour !== '9') at = new Date(Date.UTC(y, m - 1, d, 14, 30))
  const label = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
  return { at, label }
}
