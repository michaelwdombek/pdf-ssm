import { useState, useCallback } from 'react'
import { pdfjsLib } from '../lib/pdfjs'
import { imageToPdfBytes, svgToPdfBytes, textToPdfBytes } from '../utils/convertToPdf'
import { useAppContext } from '../context/AppContext'

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

export function useDocumentLoader() {
  const { dispatch } = useAppContext()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)
    try {
      const ext = getExtension(file.name)
      const mime = file.type.toLowerCase()

      let pdfBytes: Uint8Array

      if (mime === 'application/pdf' || ext === 'pdf') {
        const buf = await file.arrayBuffer()
        pdfBytes = new Uint8Array(buf)
      } else if (
        mime === 'image/svg+xml' || ext === 'svg'
      ) {
        pdfBytes = await svgToPdfBytes(file)
      } else if (
        mime.startsWith('image/') ||
        ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'].includes(ext)
      ) {
        pdfBytes = await imageToPdfBytes(file)
      } else if (mime === 'text/plain' || ext === 'txt') {
        pdfBytes = await textToPdfBytes(file)
      } else {
        throw new Error(`Unsupported file type: ${file.name}`)
      }

      // Pass a slice to PDF.js — both PDF.js and pdf-lib want ownership of the buffer
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice() })
      const pdfDocument = await loadingTask.promise

      dispatch({
        type: 'LOAD_DOCUMENT',
        payload: {
          file,
          pdfDocument,
          pdfBytes,
          pageCount: pdfDocument.numPages,
          fileName: file.name,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load document'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [dispatch])

  return { loadFile, isLoading, error }
}
