import { useEffect, useRef, type ReactNode } from 'react'

// 제목 옆 물음표. 바깥을 누르면 닫힌다
export function Tip({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  return (
    <details className="tip" ref={ref}>
      <summary aria-label={label}><span className="tip-i" aria-hidden="true">?</span></summary>
      <div className="tip-body">{children}</div>
    </details>
  )
}
