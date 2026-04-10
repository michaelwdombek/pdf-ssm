import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppContext } from '../context/AppContext'
import { apiGetJson, apiPut, apiDelete } from '../lib/api'
import type { LoadedAsset } from '../types'

interface ServerAssetMeta {
  type: 'signature' | 'stamp'
  slot: number
  name: string
  width: number
  height: number
  savedAt: string
}

async function fetchAssetImage(type: string, slot: number): Promise<{ dataUrl: string; imageBytes: Uint8Array }> {
  const response = await fetch(`/api/assets/${type}/${slot}`, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Failed to fetch asset ${type}/${slot}`)
  const blob = await response.blob()
  const imageBytes = new Uint8Array(await blob.arrayBuffer())
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
  return { dataUrl, imageBytes }
}

function metaToTypeDir(type: 'signature' | 'stamp'): string {
  return type === 'signature' ? 'signatures' : 'stamps'
}

export function useServerAssets() {
  const { auth } = useAuth()
  const { dispatch } = useAppContext()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadServerAssets = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiGetJson<{ signatures: ServerAssetMeta[]; stamps: ServerAssetMeta[] }>('/api/assets')

      const loadAsset = async (meta: ServerAssetMeta): Promise<LoadedAsset> => {
        const typeDir = metaToTypeDir(meta.type)
        const { dataUrl, imageBytes } = await fetchAssetImage(typeDir, meta.slot)
        return {
          id: `server-${meta.type}-${meta.slot}`,
          name: meta.name,
          type: meta.type,
          source: 'server',
          serverSlot: meta.slot,
          dataUrl,
          imageBytes,
          width: meta.width,
          height: meta.height,
        }
      }

      const [signatures, stamps] = await Promise.all([
        Promise.all(data.signatures.map(loadAsset)),
        Promise.all(data.stamps.map(loadAsset)),
      ])

      dispatch({ type: 'SET_SERVER_ASSETS', payload: { signatures, stamps } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server assets')
    } finally {
      setIsLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    if (auth.isAuthenticated) {
      loadServerAssets()
    } else if (!auth.isLoading) {
      dispatch({ type: 'CLEAR_SERVER_ASSETS' })
    }
  }, [auth.isAuthenticated, auth.isLoading, loadServerAssets, dispatch])

  const saveAssetToServer = useCallback(async (asset: LoadedAsset, slot: number) => {
    const typeDir = metaToTypeDir(asset.type)
    const formData = new FormData()
    const blob = new Blob([asset.imageBytes.buffer as ArrayBuffer], { type: 'image/png' })
    formData.append('file', blob, asset.name)

    await apiPut(`/api/assets/${typeDir}/${slot}`, formData)
    await loadServerAssets()
  }, [loadServerAssets])

  const deleteServerAsset = useCallback(async (type: 'signature' | 'stamp', slot: number) => {
    const typeDir = metaToTypeDir(type)
    await apiDelete(`/api/assets/${typeDir}/${slot}`)
    await loadServerAssets()
  }, [loadServerAssets])

  return { isLoading, error, saveAssetToServer, deleteServerAsset }
}
