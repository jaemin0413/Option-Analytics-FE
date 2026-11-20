import { useEffect, useState } from 'react'

// 화면마다 쓰는 조회 상태. deps가 바뀌면 다시 부른다
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    // 이전 조건의 결과가 새 조건 화면에 남지 않게 비운다
    setData(null)
    setError(null)
    load()
      .then((d) => { if (alive) setData(d) })
      .catch((e: Error) => { if (alive) setError(e.message) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, setData }
}
