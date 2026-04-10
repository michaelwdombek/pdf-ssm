import { useAppContext } from '../context/AppContext'
import { useAnnotations } from '../hooks/useAnnotations'
import { clampAnnotation } from '../utils/geometry'
import { AnnotationItem } from './AnnotationItem'

interface AnnotationLayerProps {
  canvasWidth: number
  canvasHeight: number
}

export function AnnotationLayer({ canvasWidth, canvasHeight }: AnnotationLayerProps) {
  const { state, dispatch } = useAppContext()
  const { annotations, addAnnotation } = useAnnotations()
  const { toolMode, assets } = state

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (toolMode === 'select') return
    if (!assets.activeAssetId) return

    // Find the active asset
    const allAssets = [...assets.signatures, ...assets.stamps]
    const activeAsset = allAssets.find(a => a.id === assets.activeAssetId)
    if (!activeAsset) return

    // Verify tool mode matches asset type
    if (toolMode === 'sign' && activeAsset.type !== 'signature') return
    if (toolMode === 'stamp' && activeAsset.type !== 'stamp') return

    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top

    // Default width: 20% of page width, height preserving aspect ratio
    const normW = 0.20
    const normH = normW * (activeAsset.height / activeAsset.width)

    // Center annotation on click point
    const rawX = px / canvasWidth - normW / 2
    const rawY = py / canvasHeight - normH / 2
    const { x, y } = clampAnnotation(rawX, rawY, normW, normH)

    addAnnotation({
      id: crypto.randomUUID(),
      assetId: activeAsset.id,
      type: activeAsset.type,
      page: state.document.currentPage,
      x,
      y,
      width: normW,
      height: normH,
    })

    dispatch({ type: 'SET_TOOL', payload: 'select' })
  }

  return (
    <div
      className="absolute inset-0"
      style={{
        cursor: toolMode === 'select' ? 'default' : 'crosshair',
      }}
      onPointerDown={handlePointerDown}
    >
      {annotations.map(annotation => (
        <AnnotationItem
          key={annotation.id}
          annotation={annotation}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      ))}
    </div>
  )
}
