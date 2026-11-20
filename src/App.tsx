import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { tokens } from './api'
import { Layout } from './components/Layout'
import { Login, SignUp } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { HitRate } from './pages/HitRate'
import { Journal } from './pages/Journal'
import { Ticker } from './pages/Ticker'

// 로그인 안 했으면 로그인 화면으로. 토큰이 만료됐는지는 API가 401로 알려준다
function RequireLogin({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation()
  const next = pathname + search
  return tokens.access() ? children : <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/sign-up" element={<SignUp />} />
      <Route element={<RequireLogin><Layout /></RequireLogin>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ticker/:symbol" element={<Ticker />} />
        <Route path="/hit-rates" element={<HitRate />} />
        <Route path="/journal" element={<Journal />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
