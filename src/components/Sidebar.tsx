import { useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import type { LoadedAsset } from '../types'

const ACCEPTED_IMAGE_TYPES = '.png,.jpg,.jpeg,.webp,.svg'

async function fileToAsset(file: File, type: 'signature' | 'stamp'): Promise<LoadedAsset> {
  // Get dataUrl for thumbnail display
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })

  // Get natural image dimensions
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = dataUrl
  })

  // Re-encode to PNG via canvas for consistent pdf-lib embedding
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
    dataUrl,
    imageBytes: pngBytes,
    width,
    height,
  }
}

function AssetCard({ asset, isActive, onClick, onRemove }: {
  asset: LoadedAsset
  isActive: boolean
  onClick: () => void
  onRemove: () => void
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
      {/* Remove button */}
      <button
        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
        style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}
        onClick={e => { e.stopPropagation(); onRemove() }}
        title="Remove"
      >
        ×
      </button>
    </div>
  )
}

function AssetSection({ title, assets, activeAssetId, type, onAdd, onSelect, onRemove }: {
  title: string
  assets: LoadedAsset[]
  activeAssetId: string | null
  type: 'signature' | 'stamp'
  onAdd: (asset: LoadedAsset) => void
  onSelect: (id: string) => void
  onRemove: (id: string) => void
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
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {title}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          className="btn-ghost text-xs py-0.5 px-2"
          onClick={() => inputRef.current?.click()}
          title={`Upload ${title.toLowerCase()}`}
        >
          + Upload
        </button>
      </div>
      {assets.length === 0 ? (
        <div
          {...dropHandlers}
          className="text-xs text-center py-4 rounded border border-dashed transition-colors"
          style={{
            color: isDragOver ? 'var(--color-accent)' : 'var(--color-text-faint)',
            borderColor: isDragOver ? 'var(--color-accent)' : 'var(--color-border)',
            backgroundColor: isDragOver ? 'var(--color-accent-muted)' : 'transparent',
          }}
        >
          {isDragOver ? `Drop to add ${type}` : `Drop ${type} here or click Upload`}
        </div>
      ) : (
        <div
          {...dropHandlers}
          className="grid grid-cols-2 gap-2 rounded transition-colors"
          style={isDragOver ? {
            outline: '2px dashed var(--color-accent)',
            outlineOffset: '2px',
            backgroundColor: 'var(--color-accent-muted)',
          } : undefined}
        >
          {assets.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              isActive={asset.id === activeAssetId}
              onClick={() => onSelect(asset.id)}
              onRemove={() => onRemove(asset.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { state, dispatch } = useAppContext()
  const { signatures, stamps, activeAssetId } = state.assets

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
          assets={signatures}
          activeAssetId={activeAssetId}
          type="signature"
          onAdd={asset => dispatch({ type: 'ADD_ASSET', payload: asset })}
          onSelect={id => dispatch({ type: 'SET_ACTIVE_ASSET', payload: id })}
          onRemove={id => dispatch({ type: 'REMOVE_ASSET', payload: id })}
        />
        <div className="my-3 border-t" style={{ borderColor: 'var(--color-border)' }} />
        <AssetSection
          title="Stamps"
          assets={stamps}
          activeAssetId={activeAssetId}
          type="stamp"
          onAdd={asset => dispatch({ type: 'ADD_ASSET', payload: asset })}
          onSelect={id => dispatch({ type: 'SET_ACTIVE_ASSET', payload: id })}
          onRemove={id => dispatch({ type: 'REMOVE_ASSET', payload: id })}
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
