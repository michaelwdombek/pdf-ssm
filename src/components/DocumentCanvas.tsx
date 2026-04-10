import { useRef, useEffect, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

interface DocumentCanvasProps {
  pdfDocument: PDFDocumentProxy
  currentPage: number
  zoom: number
  onSizeChange: (cssWidth: number, cssHeight: number) => void
}

export function DocumentCanvas({
  pdfDocument,
  currentPage,
  zoom,
  onSizeChange,
}: DocumentCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let renderTask: RenderTask | null = null
    let cancelled = false

    async function render() {
      try {
        const page = await pdfDocument.getPage(currentPage)
        if (cancelled) return

        const dpr = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale: zoom })

        // Set canvas buffer size at DPR resolution for sharpness
        canvas!.width = Math.round(viewport.width * dpr)
        canvas!.height = Math.round(viewport.height * dpr)
        // CSS size stays at logical pixels for overlay positioning
        canvas!.style.width = `${viewport.width}px`
        canvas!.style.height = `${viewport.height}px`

        const ctx = canvas!.getContext('2d')!
        ctx.scale(dpr, dpr)

        renderTask = page.render({ canvasContext: ctx, viewport })
        await renderTask.promise
        if (!cancelled) {
          setRenderError(null)
          onSizeChange(viewport.width, viewport.height)
        }
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Render error'
        if (!msg.includes('cancelled') && !msg.includes('canceled')) {
          setRenderError(msg)
        }
      }
    }

    render()

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pdfDocument, currentPage, zoom, onSizeChange])

  return (
    <div className="relative inline-block">
      {renderError && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-1 text-danger text-sm p-4">
          Render error: {renderError}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="block shadow-md"
        style={{ background: 'white' }}
      />
    </div>
  )
}
