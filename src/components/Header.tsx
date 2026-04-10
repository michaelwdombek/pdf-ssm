import { useRef } from 'react'
import { useAppContext } from '../context/AppContext'
import { useDocumentLoader } from '../hooks/useDocumentLoader'
import { useAnnotations } from '../hooks/useAnnotations'
import { useExport } from '../hooks/useExport'
import type { ToolMode } from '../types'

const ACCEPTED_DOC_TYPES = '.pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.tif,.svg,.txt'

const TOOL_BUTTONS: { mode: ToolMode; label: string; shortcut: string; title: string }[] = [
  { mode: 'select', label: 'Select', shortcut: 'V', title: 'Select / Move (V)' },
  { mode: 'sign',   label: 'Sign',   shortcut: 'S', title: 'Place Signature (S)' },
  { mode: 'stamp',  label: 'Stamp',  shortcut: 'T', title: 'Place Stamp (T)' },
]

export function Header() {
  const { state, dispatch } = useAppContext()
  const { loadFile, isLoading } = useDocumentLoader()
  const { canUndo, canRedo, undo, redo } = useAnnotations()
  const { exportPdf, isExporting } = useExport()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasDoc = state.document.pdfDocument !== null
  const toolMode = state.toolMode

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
    e.target.value = ''
  }

  return (
    <header
      className="flex items-center gap-3 px-4 h-12 border-b shrink-0"
      style={{
        backgroundColor: 'var(--color-surface-1)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Logo */}
      <span
        className="font-semibold tracking-tight mr-2 shrink-0"
        style={{ color: 'var(--color-accent)', fontSize: '15px', letterSpacing: '-0.02em' }}
      >
        SignDesk
      </span>

      {/* Divider */}
      <div className="h-5 w-px shrink-0" style={{ background: 'var(--color-border)' }} />

      {/* Open Document */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_DOC_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        className="btn-secondary"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        title="Open document"
      >
        {isLoading ? 'Loading…' : 'Open Document'}
      </button>

      {/* Tool mode switcher */}
      {hasDoc && (
        <>
          <div className="h-5 w-px shrink-0" style={{ background: 'var(--color-border)' }} />
          <div className="flex gap-1">
            {TOOL_BUTTONS.map(({ mode, label, title }) => (
              <button
                key={mode}
                className={toolMode === mode ? 'btn-primary' : 'btn-secondary'}
                onClick={() => dispatch({ type: 'SET_TOOL', payload: mode })}
                title={title}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Undo / Redo */}
      {hasDoc && (
        <>
          <button
            className="btn-ghost"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            className="btn-ghost"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
          </button>
          <div className="h-5 w-px shrink-0" style={{ background: 'var(--color-border)' }} />
          <button
            className="btn-accent"
            onClick={exportPdf}
            disabled={isExporting}
            title="Save PDF"
          >
            {isExporting ? 'Saving…' : 'Save PDF'}
          </button>
        </>
      )}
    </header>
  )
}
