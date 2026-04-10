import { useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useDocumentLoader } from '../hooks/useDocumentLoader'
import { useAnnotations } from '../hooks/useAnnotations'
import { useExport } from '../hooks/useExport'
import { useServerDocument } from '../hooks/useServerDocument'
import type { ToolMode } from '../types'

const ACCEPTED_DOC_TYPES = '.pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.tif,.svg,.txt'

const TOOL_BUTTONS: { mode: ToolMode; label: string; shortcut: string; title: string }[] = [
  { mode: 'select', label: 'Select', shortcut: 'V', title: 'Select / Move (V)' },
  { mode: 'sign',   label: 'Sign',   shortcut: 'S', title: 'Place Signature (S)' },
  { mode: 'stamp',  label: 'Stamp',  shortcut: 'T', title: 'Place Stamp (T)' },
]

function UserMenu() {
  const { auth, login, logout } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)

  if (auth.isLoading) {
    return (
      <div
        className="w-7 h-7 rounded-full animate-pulse"
        style={{ backgroundColor: 'var(--color-surface-2)' }}
      />
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <button className="btn-secondary" onClick={login}>
        Sign In
      </button>
    )
  }

  const initials = (auth.user?.displayName ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="relative">
      <button
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
        style={{
          backgroundColor: 'var(--color-accent)',
          color: 'white',
        }}
        onClick={() => setShowDropdown(!showDropdown)}
        title={auth.user?.displayName ?? 'User'}
      >
        {initials}
      </button>
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          {/* Dropdown */}
          <div
            className="absolute right-0 top-full mt-1 w-56 rounded shadow-lg border z-50 py-2"
            style={{
              backgroundColor: 'var(--color-surface-1)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="px-3 py-1.5">
              <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {auth.user?.displayName}
              </div>
              {auth.user?.email && (
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {auth.user.email}
                </div>
              )}
            </div>
            <div className="my-1 border-t" style={{ borderColor: 'var(--color-border)' }} />
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:opacity-80"
              style={{ color: 'var(--color-text-muted)' }}
              onClick={() => { setShowDropdown(false); logout() }}
            >
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function Header() {
  const { state, dispatch } = useAppContext()
  const { auth } = useAuth()
  const { loadFile, isLoading } = useDocumentLoader()
  const { canUndo, canRedo, undo, redo } = useAnnotations()
  const { exportPdf, isExporting } = useExport()
  const { savedDocMeta, isSaving, isLoadingFromServer, saveToServer, loadFromServer } = useServerDocument()
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
        {isLoading ? 'Loading...' : 'Open Document'}
      </button>

      {/* Load from Server */}
      {auth.isAuthenticated && savedDocMeta && !hasDoc && (
        <button
          className="btn-secondary"
          onClick={loadFromServer}
          disabled={isLoadingFromServer}
          title={`Load "${savedDocMeta.fileName}" from server`}
        >
          {isLoadingFromServer ? 'Loading...' : 'Load from Server'}
        </button>
      )}

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
            title="Save PDF locally"
          >
            {isExporting ? 'Saving...' : 'Save PDF'}
          </button>

          {/* Save to Server */}
          {auth.isAuthenticated && (
            <button
              className="btn-secondary"
              onClick={saveToServer}
              disabled={isSaving}
              title="Save document to server"
            >
              {isSaving ? 'Uploading...' : 'Save to Server'}
            </button>
          )}
        </>
      )}

      {/* Divider before user menu */}
      <div className="h-5 w-px shrink-0" style={{ background: 'var(--color-border)' }} />

      {/* User menu */}
      <UserMenu />
    </header>
  )
}
