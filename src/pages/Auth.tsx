import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api, tokens } from '../api'

export function Login() {
  const joined = (useLocation().state as { joined?: string } | null)?.joined
  const [params] = useSearchParams()
  const [email, setEmail] = useState(joined ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      tokens.save(await api.login(email, password))
      localStorage.setItem('email', email)
      // 주소창에서 온 값이라 앱 안 경로('/'로 시작, '//' 아님)만 받는다
      const next = params.get('next')
      navigate(next?.startsWith('/') && !next.startsWith('//') ? next : '/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <title>로그인 · Option</title>
      <div className="auth-inner">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 34, lineHeight: 1.15 }}>Option</h1>
          <p className="sub" style={{ fontSize: 16 }}>장 전과 장 후, 하루 두 번 여는 옵션 참고 도구</p>
        </div>
        <form className="card" onSubmit={submit}>
          {joined && <p role="status" className="muted">가입했습니다. 로그인해 주세요.</p>}
          <div className="field">
            <label htmlFor="login-email">이메일</label>
            <input id="login-email" className="input" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="login-password">비밀번호</label>
            <input id="login-password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          <button type="submit" className="btn" disabled={busy}>로그인</button>
        </form>
        <p className="sub" style={{ textAlign: 'center', fontSize: 15 }}>
          계정이 없다면 <Link to="/sign-up" style={{ fontWeight: 700, display: 'inline-block', padding: '12px 4px' }}>회원가입</Link>
        </p>
      </div>
    </div>
  )
}

export function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.signUp(email, password)
      navigate('/login', { state: { joined: email } })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <title>회원가입 · Option</title>
      <div className="auth-inner">
        <h1 style={{ fontSize: 28 }}>회원가입</h1>
        <form className="card" onSubmit={submit}>
          <div className="field">
            <label htmlFor="signup-email">이메일</label>
            <input id="signup-email" className="input" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="signup-password">비밀번호</label>
            <input id="signup-password" className="input" type="password" autoComplete="new-password" aria-describedby="signup-password-hint" required minLength={8} maxLength={64} value={password} onChange={(e) => setPassword(e.target.value)} />
            <span id="signup-password-hint" className="small">8자 이상 64자 이하</span>
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          <button type="submit" className="btn" disabled={busy}>가입하기</button>
        </form>
        <p className="sub" style={{ textAlign: 'center', fontSize: 15 }}>
          이미 계정이 있다면 <Link to="/login" style={{ fontWeight: 700, display: 'inline-block', padding: '12px 4px' }}>로그인</Link>
        </p>
      </div>
    </div>
  )
}
