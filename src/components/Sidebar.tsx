import { useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useServerAssets } from '../hooks/useServerAssets'
import type { LoadedAsset } from '../types'

const ACCEPTED_IMAGE_TYPES = '.png,.jpg,.jpeg,.webp,.svg'

const SERVER_LIMITS: Record<string, number> = { signature: 2, stamp: 1 }

async function fileToAsset(file: File, type: 'signature' | 'stamp'): Promise<LoadedAsset> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })

  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = dataUrl
  })

  const pngBytes = await new Promise<Uint8Array>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('toBlob failed')); return }
        blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf))).catch(reject)
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Re-encode failed'))
    img.src = dataUrl
  })

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type,
    source: 'local',
    dataUrl,
    imageBytes: pngBytes,
    width,
    height,
  }
}

function AssetCard({ asset, isActive, onClick, onRemove, showSourceBadge, onSaveToProfile }: {
  asset: LoadedAsset
  isActive: boolean
  onClick: () => void
  onRemove: () => void
  showSourceBadge?: boolean
  onSaveToProfile?: () => void
}) {
  return (
    <div
      className="relative group cursor-pointer rounded overflow-hidden border transition-all"
      style={{
        borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
        backgroundColor: isActive ? 'var(--color-accent-muted)' : 'var(--color-surface-2)',
        boxShadow: isActive ? '0 0 0 2px var(--color-accent)' : 'none',
      }}
      onClick={onClick}
      title={asset.name}
    >
      {/* Source badge */}
      {showSourceBadge && asset.source === 'server' && (
        <div
          className="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] z-10"
          style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
          title="Saved to profile"
        >
          P
        </div>
      )}
      <div className="flex items-center justify-center h-16 p-2">
        <img
          src={asset.dataUrl}
          alt={asset.name}
          className="max-h-full max-w-full object-contain"
          style={{ imageRendering: 'auto' }}
        />
      </div>
      <div
        className="px-2 pb-1 text-xs truncate"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {asset.name}
      </div>
      {/* Action buttons */}
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onSaveToProfile && (
          <button
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs leading-none"
            style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
            onClick={e => { e.stopPropagation(); onSaveToProfile() }}
            title="Save to profile"
          >
            +
          </button>
        )}
        <button
          className="w-5 h-5 rounded-full flex items-center justify-center text-xs leading-none"
          style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}
          onClick={e => { e.stopPropagation(); onRemove() }}
          title={asset.source === 'server' ? 'Remove from profile' : 'Remove'}
        >
          x
        </button>
      </div>
    </div>
  )
}

function AssetUploadSection({ type, onAdd }: {
  type: 'signature' | 'stamp'
  onAdd: (asset: LoadedAsset) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  async function loadAssetFile(file: File) {
    try {
      const asset = await fileToAsset(file, type)
      onAdd(asset)
    } catch (err) {
      console.error('Failed to load asset:', err)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await loadAssetFile(file)
    e.target.value = ''
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) await loadAssetFile(file)
  }

  const dropHandlers = { onDragEnter: handleDragEnter, onDragLeave: handleDragLeave, onDragOver: handleDragOver, onDrop: handleDrop }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        {...dropHandlers}
        className="text-xs text-center py-3 rounded border border-dashed transition-colors cursor-pointer"
        style={{
          color: isDragOver ? 'var(--color-accent)' : 'var(--color-text-faint)',
          borderColor: isDragOver ? 'var(--color-accent)' : 'var(--color-border)',
          backgroundColor: isDragOver ? 'var(--color-accent-muted)' : 'transparent',
        }}
        onClick={() => inputRef.current?.click()}
      >
        {isDragOver ? `Drop to add ${type}` : `Drop ${type} here or click to upload`}
      </div>
    </div>
  )
}

function AssetGroup({ title, assets, activeAssetId, onSelect, onRemove, showSourceBadge, onSaveToProfile }: {
  title: string
  assets: LoadedAsset[]
  activeAssetId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  showSourceBadge?: boolean
  onSaveToProfile?: (asset: LoadedAsset) => void
}) {
  if (assets.length === 0) return null

  return (
    <div className="mb-2">
      <span
        className="text-[10px] uppercase tracking-wider mb-1 block"
        style={{ color: 'var(--color-text-faint)' }}
      >
        {title}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {assets.map(asset => (
          <AssetCard
            key={asset.id}
            asset={asset}
            isActive={asset.id === activeAssetId}
            onClick={() => onSelect(asset.id)}
            onRemove={() => onRemove(asset.id)}
            showSourceBadge={showSourceBadge}
            onSaveToProfile={onSaveToProfile ? () => onSaveToProfile(asset) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function AssetSection({ title, type, serverAssets, localAssets, activeAssetId, isAuthenticated, onAddLocal, onSelect, onRemoveLocal, onRemoveServer, onSaveToProfile }: {
  title: string
  type: 'signature' | 'stamp'
  serverAssets: LoadedAsset[]
  localAssets: LoadedAsset[]
  activeAssetId: string | null
  isAuthenticated: boolean
  onAddLocal: (asset: LoadedAsset) => void
  onSelect: (id: string) => void
  onRemoveLocal: (id: string) => void
  onRemoveServer: (type: 'signature' | 'stamp', slot: number) => void
  onSaveToProfile: (asset: LoadedAsset) => void
}) {
  const serverSlotsFull = serverAssets.length >= (SERVER_LIMITS[type] ?? 0)
  const canSaveToProfile = isAuthenticated && !serverSlotsFull

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {title}
        </span>
      </div>

      {/* Server (Profile) assets */}
      {isAuthenticated && (
        <AssetGroup
          title="Profile"
          assets={serverAssets}
          activeAssetId={activeAssetId}
          onSelect={onSelect}
          onRemove={id => {
            const asset = serverAssets.find(a => a.id === id)
            if (asset?.serverSlot != null) onRemoveServer(asset.type, asset.serverSlot)
          }}
          showSourceBadge
        />
      )}

      {/* Local (Session) assets */}
      <AssetGroup
        title={isAuthenticated ? 'Session' : ''}
        assets={localAssets}
        activeAssetId={activeAssetId}
        onSelect={onSelect}
        onRemove={onRemoveLocal}
        onSaveToProfile={canSaveToProfile ? onSaveToProfile : undefined}
      />

      {/* Upload area */}
      <AssetUploadSection type={type} onAdd={onAddLocal} />
    </div>
  )
}

export function Sidebar() {
  const { state, dispatch } = useAppContext()
  const { auth } = useAuth()
  const { saveAssetToServer, deleteServerAsset } = useServerAssets()
  const { signatures, stamps, activeAssetId } = state.assets

  const serverSigs = signatures.filter(a => a.source === 'server')
  const localSigs = signatures.filter(a => a.source === 'local')
  const serverStamps = stamps.filter(a => a.source === 'server')
  const localStamps = stamps.filter(a => a.source === 'local')

  function findNextSlot(type: 'signature' | 'stamp'): number {
    const serverAssets = type === 'signature' ? serverSigs : serverStamps
    const usedSlots = new Set(serverAssets.map(a => a.serverSlot))
    const max = SERVER_LIMITS[type] ?? 1
    for (let i = 1; i <= max; i++) {
      if (!usedSlots.has(i)) return i
    }
    return -1
  }

  async function handleSaveToProfile(asset: LoadedAsset) {
    const slot = findNextSlot(asset.type)
    if (slot === -1) return
    try {
      await saveAssetToServer(asset, slot)
      // Remove the local copy after saving to server
      dispatch({ type: 'REMOVE_ASSET', payload: asset.id })
    } catch (err) {
      console.error('Failed to save to profile:', err)
    }
  }

  async function handleRemoveServer(type: 'signature' | 'stamp', slot: number) {
    try {
      await deleteServerAsset(type, slot)
    } catch (err) {
      console.error('Failed to remove from profile:', err)
    }
  }

  return (
    <aside
      className="w-64 shrink-0 flex flex-col border-r overflow-y-auto"
      style={{
        backgroundColor: 'var(--color-surface-1)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="p-3 flex-1">
        <AssetSection
          title="Signatures"
          type="signature"
          serverAssets={serverSigs}
          localAssets={localSigs}
          activeAssetId={activeAssetId}
          isAuthenticated={auth.isAuthenticated}
          onAddLocal={asset => dispatch({ type: 'ADD_ASSET', payload: asset })}
          onSelect={id => dispatch({ type: 'SET_ACTIVE_ASSET', payload: id })}
          onRemoveLocal={id => dispatch({ type: 'REMOVE_ASSET', payload: id })}
          onRemoveServer={handleRemoveServer}
          onSaveToProfile={handleSaveToProfile}
        />
        <div className="my-3 border-t" style={{ borderColor: 'var(--color-border)' }} />
        <AssetSection
          title="Stamps"
          type="stamp"
          serverAssets={serverStamps}
          localAssets={localStamps}
          activeAssetId={activeAssetId}
          isAuthenticated={auth.isAuthenticated}
          onAddLocal={asset => dispatch({ type: 'ADD_ASSET', payload: asset })}
          onSelect={id => dispatch({ type: 'SET_ACTIVE_ASSET', payload: id })}
          onRemoveLocal={id => dispatch({ type: 'REMOVE_ASSET', payload: id })}
          onRemoveServer={handleRemoveServer}
          onSaveToProfile={handleSaveToProfile}
        />
      </div>

      {/* Tool mode hint */}
      {state.document.pdfDocument && (
        <div
          className="px-3 pb-3 text-xs"
          style={{ color: 'var(--color-text-faint)' }}
        >
          {state.toolMode === 'select' && 'Click annotation to select. Drag to move.'}
          {state.toolMode === 'sign' && 'Click document to place signature.'}
          {state.toolMode === 'stamp' && 'Click document to place stamp.'}
        </div>
      )}
    </aside>
  )
}
