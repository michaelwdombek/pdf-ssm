import { useState, useCallback } from 'react'
import { useAppContext } from '../context/AppContext'
import { exportAnnotatedPdf } from '../utils/pdfExport'

export function useExport() {
  const { state } = useAppContext()
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportPdf = useCallback(async () => {
    const { pdfBytes, fileName } = state.document
    if (!pdfBytes) return

    setIsExporting(true)
    setError(null)
    try {
      const allAssets = [...state.assets.signatures, ...state.assets.stamps]
      await exportAnnotatedPdf(pdfBytes, state.annotations, allAssets, fileName)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      setError(message)
    } finally {
      setIsExporting(false)
    }
  }, [state.document, state.annotations, state.assets])

  return { exportPdf, isExporting, error }
}
