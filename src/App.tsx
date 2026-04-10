import { useState, useEffect, useCallback, useRef } from 'react'
import { AppProvider, useAppContext } from './context/AppContext'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { DocumentCanvas } from './components/DocumentCanvas'
import { AnnotationLayer } from './components/AnnotationLayer'
import { PageNavigation } from './components/PageNavigation'
import { StatusBar } from './components/StatusBar'
import { useAnnotations } from './hooks/useAnnotations'
import { useDocumentLoader } from './hooks/useDocumentLoader'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4.0
const ZOOM_STEP = 0.25

const DOC_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'svg', 'txt'])

function getExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function isDocFile(file: DataTransferItem | File) {
  if (file instanceof File) {
    return DOC_EXTENSIONS.has(getExt(file.name))
  }
  // DataTransferItem during dragover — only type is available, not name
  return file.kind === 'file'
}

function AppInner() {
  const { state, dispatch } = useAppContext()
  const { undo, redo, deleteAnnotation, selectedId } = useAnnotations()
  const { loadFile } = useDocumentLoader()
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  const hasDoc = state.document.pdfDocument !== null

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const ctrl = isMac ? e.metaKey : e.ctrlKey

      // Undo
      if (ctrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        undo()
        return
      }
      // Redo
      if ((ctrl && e.shiftKey && e.key === 'z') || (ctrl && e.key === 'y')) {
        e.preventDefault()
        redo()
        return
      }
      // Delete selected annotation
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && state.toolMode === 'select') {
        // Don't intercept when focus is in an input
        if (document.activeElement instanceof HTMLInputElement ||
            document.activeElement instanceof HTMLTextAreaElement) return
        e.preventDefault()
        deleteAnnotation(selectedId)
        return
      }
      // Tool shortcuts (only when a doc is loaded)
      if (!hasDoc) return
      if (e.key === 'v' || e.key === 'V') dispatch({ type: 'SET_TOOL', payload: 'select' })
      if (e.key === 's' || e.key === 'S') dispatch({ type: 'SET_TOOL', payload: 'sign' })
      if (e.key === 't' || e.key === 'T') dispatch({ type: 'SET_TOOL', payload: 'stamp' })
      // Arrow key page navigation
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const next = Math.min(state.document.currentPage + 1, state.document.pageCount)
        if (next !== state.document.currentPage) dispatch({ type: 'SET_PAGE', payload: next })
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const prev = Math.max(state.document.currentPage - 1, 1)
        if (prev !== state.document.currentPage) dispatch({ type: 'SET_PAGE', payload: prev })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, deleteAnnotation, selectedId, state.toolMode, state.document.currentPage, state.document.pageCount, hasDoc, dispatch])

  // Ctrl+wheel zoom
  useEffect(() => {
    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.document.zoom + delta))
      dispatch({ type: 'SET_ZOOM', payload: newZoom })
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [state.document.zoom, dispatch])

  const handleSizeChange = useCallback((w: number, h: number) => {
    setCanvasSize({ width: w, height: h })
  }, [])

  // --- Global drag-and-drop for document files ---
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current++
    if (e.dataTransfer.items.length > 0 && isDocFile(e.dataTransfer.items[0])) {
      setIsDragOver(true)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && isDocFile(file)) loadFile(file)
  }

  return (
    <div
      className="flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Full-screen drop overlay */}
      {isDragOver && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 pointer-events-none"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--color-accent) 12%, transparent)',
            border: '3px dashed var(--color-accent)',
          }}
        >
          <div style={{ fontSize: '40px', opacity: 0.7 }}>📄</div>
          <p style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: '16px' }}>
            Drop to open document
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
            PDF, PNG, JPG, WebP, BMP, TIFF, SVG, TXT
          </p>
        </div>
      )}
      <Header />

      <div className="flex flex-1 min-h-0">
        <Sidebar />

        {/* Main document area */}
        <div
          className="flex-1 flex flex-col min-w-0"
          style={{ backgroundColor: 'var(--color-surface-0)' }}
        >
          {hasDoc ? (
            <>
              {/* Zoom controls */}
              <div
                className="flex items-center gap-2 px-4 py-1.5 border-b"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-1)' }}
              >
                <button
                  className="btn-ghost text-xs px-2 py-0.5"
                  onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(ZOOM_MIN, state.document.zoom - ZOOM_STEP) })}
                  title="Zoom out"
                >
                  −
                </button>
                <span
                  className="text-xs w-14 text-center"
                  style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--color-text-muted)' }}
                >
                  {Math.round(state.document.zoom * 100)}%
                </span>
                <button
                  className="btn-ghost text-xs px-2 py-0.5"
                  onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(ZOOM_MAX, state.document.zoom + ZOOM_STEP) })}
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  className="btn-ghost text-xs px-2 py-0.5"
                  onClick={() => dispatch({ type: 'SET_ZOOM', payload: 1.0 })}
                  title="Reset zoom"
                >
                  100%
                </button>
              </div>

              {/* Canvas viewport */}
              <div className="flex-1 overflow-auto">
                <div className="flex justify-center py-6 px-6 min-h-full">
                  {/* Canvas + overlay wrapper */}
                  <div
                    className="relative inline-block select-none"
                    style={{
                      width: canvasSize.width || 'auto',
                      height: canvasSize.height || 'auto',
                    }}
                  >
                    <DocumentCanvas
                      pdfDocument={state.document.pdfDocument!}
                      currentPage={state.document.currentPage}
                      zoom={state.document.zoom}
                      onSizeChange={handleSizeChange}
                    />
                    {canvasSize.width > 0 && (
                      <AnnotationLayer
                        canvasWidth={canvasSize.width}
                        canvasHeight={canvasSize.height}
                      />
                    )}
                  </div>
                </div>
              </div>

              <PageNavigation />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div style={{ fontSize: '48px', opacity: 0.2 }}>📄</div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
                Open a document to get started
              </p>
              <p style={{ color: 'var(--color-text-faint)', fontSize: '13px' }}>
                Supported: PDF, PNG, JPG, WebP, BMP, TIFF, SVG, TXT
              </p>
            </div>
          )}
        </div>
      </div>

      <StatusBar />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
