import { useAppContext } from '../context/AppContext'

export function StatusBar() {
  const { state } = useAppContext()
  const { fileName, currentPage, pageCount, zoom } = state.document
  const hasDoc = state.document.pdfDocument !== null
  const annotationCount = (state.annotations[currentPage] ?? []).length
  const unsaved = state.history.past.length > 0

  return (
    <footer
      className="flex items-center gap-4 px-4 h-7 border-t text-xs shrink-0"
      style={{
        backgroundColor: 'var(--color-surface-1)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-muted)',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      {hasDoc ? (
        <>
          <span className="truncate max-w-48" title={fileName}>{fileName}</span>
          <span className="text-faint">·</span>
          <span>p. {currentPage}/{pageCount}</span>
          <span className="text-faint">·</span>
          <span>{Math.round(zoom * 100)}%</span>
          {annotationCount > 0 && (
            <>
              <span className="text-faint">·</span>
              <span>{annotationCount} annotation{annotationCount !== 1 ? 's' : ''} on page</span>
            </>
          )}
          {unsaved && (
            <>
              <span className="text-faint">·</span>
              <span style={{ color: 'var(--color-accent)' }}>Unsaved changes</span>
            </>
          )}
        </>
      ) : (
        <span>No document loaded — open a PDF, image, or text file</span>
      )}
    </footer>
  )
}
