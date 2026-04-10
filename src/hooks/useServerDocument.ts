import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppContext } from '../context/AppContext'
import { apiGetJson, apiGet, apiPut, apiDelete } from '../lib/api'
import type { ServerDocumentMeta, Annotation } from '../types'
import { pdfjsLib } from '../lib/pdfjs'

export function useServerDocument() {
  const { auth } = useAuth()
  const { state, dispatch } = useAppContext()
  const [savedDocMeta, setSavedDocMeta] = useState<ServerDocumentMeta | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingFromServer, setIsLoadingFromServer] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if server has a saved document
  const checkServerDocument = useCallback(async () => {
    try {
      const meta = await apiGetJson<ServerDocumentMeta>('/api/documents/current')
      setSavedDocMeta(meta)
    } catch {
      setSavedDocMeta(null)
    }
  }, [])

  useEffect(() => {
    if (auth.isAuthenticated) {
      checkServerDocument()
    } else {
      setSavedDocMeta(null)
    }
  }, [auth.isAuthenticated, checkServerDocument])

  const saveToServer = useCallback(async () => {
    if (!state.document.pdfBytes) return

    setIsSaving(true)
    setError(null)
    try {
      const formData = new FormData()
      const pdfBlob = new Blob([state.document.pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      formData.append('file', pdfBlob, state.document.fileName)
      formData.append('annotations', JSON.stringify(state.annotations))
      formData.append('meta', JSON.stringify({
        fileName: state.document.fileName,
        pageCount: state.document.pageCount,
      }))

      await apiPut('/api/documents/current', formData)
      await checkServerDocument()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document')
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [state.document.pdfBytes, state.document.fileName, state.document.pageCount, state.annotations, checkServerDocument])

  const loadFromServer = useCallback(async () => {
    if (!savedDocMeta) return

    setIsLoadingFromServer(true)
    setError(null)
    try {
      // Fetch PDF file
      const pdfResponse = await apiGet('/api/documents/current/file')
      const pdfBuffer = await pdfResponse.arrayBuffer()
      const pdfBytes = new Uint8Array(pdfBuffer)

      // Fetch annotations
      let annotations: Record<number, Annotation[]> = {}
      try {
        annotations = await apiGetJson<Record<number, Annotation[]>>('/api/documents/current/annotations')
      } catch {
        // No annotations saved — that's fine
      }

      // Load into PDF.js
      const pdfDocument = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise

      // Create a File object for state
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const file = new File([blob], savedDocMeta.fileName, { type: 'application/pdf' })

      dispatch({
        type: 'LOAD_SERVER_DOCUMENT',
        payload: {
          file,
          pdfDocument,
          pdfBytes,
          pageCount: pdfDocument.numPages,
          fileName: savedDocMeta.fileName,
          annotations,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
      throw err
    } finally {
      setIsLoadingFromServer(false)
    }
  }, [savedDocMeta, dispatch])

  const deleteFromServer = useCallback(async () => {
    setError(null)
    try {
      await apiDelete('/api/documents/current')
      setSavedDocMeta(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
      throw err
    }
  }, [])

  return {
    savedDocMeta,
    isSaving,
    isLoadingFromServer,
    error,
    saveToServer,
    loadFromServer,
    deleteFromServer,
  }
}
