import { useState, useEffect } from 'react'
import { useAppContext } from '../context/AppContext'

export function PageNavigation() {
  const { state, dispatch } = useAppContext()
  const { currentPage, pageCount } = state.document
  const [inputValue, setInputValue] = useState(String(currentPage))

  // Sync input when currentPage changes externally (e.g. after doc load)
  useEffect(() => {
    setInputValue(String(currentPage))
  }, [currentPage])

  function goTo(page: number) {
    const clamped = Math.max(1, Math.min(page, pageCount))
    dispatch({ type: 'SET_PAGE', payload: clamped })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value)
  }

  function handleInputCommit() {
    const parsed = parseInt(inputValue, 10)
    if (!isNaN(parsed)) {
      goTo(parsed)
    } else {
      setInputValue(String(currentPage))
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleInputCommit()
    if (e.key === 'Escape') setInputValue(String(currentPage))
  }

  return (
    <div
      className="flex items-center justify-center gap-2 py-2 border-t"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <button
        className="btn-ghost px-3"
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage <= 1}
        title="Previous page (←)"
      >
        ‹
      </button>

      <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <span>Page</span>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputCommit}
          onKeyDown={handleInputKeyDown}
          className="w-12 text-center rounded border px-1 py-0.5 text-sm outline-none"
          style={{
            backgroundColor: 'var(--color-surface-0)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          aria-label="Current page"
        />
        <span>of {pageCount}</span>
      </div>

      <button
        className="btn-ghost px-3"
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage >= pageCount}
        title="Next page (→)"
      >
        ›
      </button>
    </div>
  )
}
