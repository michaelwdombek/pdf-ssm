import { useState, useRef } from 'react'
import { useAppContext } from '../context/AppContext'
import { useAnnotations } from '../hooks/useAnnotations'
import { clampAnnotation } from '../utils/geometry'
import type { Annotation } from '../types'

interface AnnotationItemProps {
  annotation: Annotation
  canvasWidth: number
  canvasHeight: number
}

type Corner = 'nw' | 'ne' | 'se' | 'sw'

interface DragRef {
  startPointerX: number
  startPointerY: number
  startAnnotX: number
  startAnnotY: number
}

interface ResizeRef {
  corner: Corner
  startPointerX: number
  startPointerY: number
  startAnnotX: number
  startAnnotY: number
  startAnnotW: number
  startAnnotH: number
}

export function AnnotationItem({ annotation, canvasWidth, canvasHeight }: AnnotationItemProps) {
  const { state } = useAppContext()
  const { moveAnnotation, resizeAnnotation, selectAnnotation, selectedId } = useAnnotations()

  const isSelected = selectedId === annotation.id
  const toolMode = state.toolMode

  // Local live position during drag/resize (avoids flooding undo history)
  const [livePos, setLivePos] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const dragRef = useRef<DragRef | null>(null)
  const resizeRef = useRef<ResizeRef | null>(null)

  const displayPos = livePos ?? { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height }

  // Find the asset for this annotation
  const allAssets = [...state.assets.signatures, ...state.assets.stamps]
  const asset = allAssets.find(a => a.id === annotation.assetId)

  const left = displayPos.x * canvasWidth
  const top = displayPos.y * canvasHeight
  const width = displayPos.width * canvasWidth
  const height = displayPos.height * canvasHeight

  // --- Drag ---
  function handleDragPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (toolMode !== 'select') return
    e.stopPropagation()
    e.preventDefault()

    selectAnnotation(annotation.id)

    dragRef.current = {
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startAnnotX: annotation.x,
      startAnnotY: annotation.y,
    }

    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
  }

  function handleDragPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const { startPointerX, startPointerY, startAnnotX, startAnnotY } = dragRef.current
    const dx = (e.clientX - startPointerX) / canvasWidth
    const dy = (e.clientY - startPointerY) / canvasHeight
    const { x, y } = clampAnnotation(startAnnotX + dx, startAnnotY + dy, annotation.width, annotation.height)
    setLivePos({ x, y, width: annotation.width, height: annotation.height })
  }

  function handleDragPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const { startPointerX, startPointerY, startAnnotX, startAnnotY } = dragRef.current
    const dx = (e.clientX - startPointerX) / canvasWidth
    const dy = (e.clientY - startPointerY) / canvasHeight
    const { x, y } = clampAnnotation(startAnnotX + dx, startAnnotY + dy, annotation.width, annotation.height)
    dragRef.current = null
    setLivePos(null)
    // Commit to store (pushes to undo history)
    moveAnnotation(annotation.id, x, y)
  }

  // --- Resize ---
  function handleResizePointerDown(corner: Corner, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()

    resizeRef.current = {
      corner,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startAnnotX: annotation.x,
      startAnnotY: annotation.y,
      startAnnotW: annotation.width,
      startAnnotH: annotation.height,
    }

    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
  }

  function handleResizePointerMove(corner: Corner, e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current || resizeRef.current.corner !== corner) return
    const ref = resizeRef.current
    const dx = (e.clientX - ref.startPointerX) / canvasWidth
    const ar = ref.startAnnotH / ref.startAnnotW

    let newX = ref.startAnnotX
    let newY = ref.startAnnotY
    let newW = ref.startAnnotW
    let newH = ref.startAnnotH

    switch (corner) {
      case 'se':
        newW = Math.max(0.03, ref.startAnnotW + dx)
        newH = newW * ar
        break
      case 'sw':
        newW = Math.max(0.03, ref.startAnnotW - dx)
        newH = newW * ar
        newX = ref.startAnnotX + ref.startAnnotW - newW
        break
      case 'ne':
        newW = Math.max(0.03, ref.startAnnotW + dx)
        newH = newW * ar
        newY = ref.startAnnotY + ref.startAnnotH - newH
        break
      case 'nw':
        newW = Math.max(0.03, ref.startAnnotW - dx)
        newH = newW * ar
        newX = ref.startAnnotX + ref.startAnnotW - newW
        newY = ref.startAnnotY + ref.startAnnotH - newH
        break
    }

    const { x, y } = clampAnnotation(newX, newY, newW, newH)
    setLivePos({ x, y, width: newW, height: newH })
  }

  function handleResizePointerUp(corner: Corner, _e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current || resizeRef.current.corner !== corner) return
    resizeRef.current = null
    if (livePos) {
      const { x, y, width, height } = livePos
      setLivePos(null)
      resizeAnnotation(annotation.id, x, y, width, height)
    } else {
      setLivePos(null)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (toolMode === 'select') {
      e.stopPropagation()
      selectAnnotation(annotation.id)
    }
  }

  if (!asset) return null

  const HANDLE_SIZE = 8
  const HANDLE_OFFSET = -4

  const cornerStyles: Record<Corner, React.CSSProperties> = {
    nw: { top: HANDLE_OFFSET, left: HANDLE_OFFSET, cursor: 'nw-resize' },
    ne: { top: HANDLE_OFFSET, right: HANDLE_OFFSET, cursor: 'ne-resize' },
    se: { bottom: HANDLE_OFFSET, right: HANDLE_OFFSET, cursor: 'se-resize' },
    sw: { bottom: HANDLE_OFFSET, left: HANDLE_OFFSET, cursor: 'sw-resize' },
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: left,
        top: top,
        width: width,
        height: height,
        cursor: toolMode === 'select' ? (dragRef.current ? 'grabbing' : 'grab') : 'default',
        outline: isSelected ? '2px solid var(--color-accent)' : annotation.type === 'stamp' ? '1px dashed var(--color-stamp-border)' : 'none',
        outlineOffset: isSelected ? '1px' : '0',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={handleDragPointerDown}
      onPointerMove={handleDragPointerMove}
      onPointerUp={handleDragPointerUp}
      onClick={handleClick}
    >
      <img
        src={asset.dataUrl}
        alt={asset.name}
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
      />

      {/* Resize handles — only visible when selected */}
      {isSelected && toolMode === 'select' && (
        (['nw', 'ne', 'se', 'sw'] as Corner[]).map(corner => (
          <div
            key={corner}
            style={{
              position: 'absolute',
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              backgroundColor: 'var(--color-accent)',
              border: '1.5px solid white',
              borderRadius: '2px',
              touchAction: 'none',
              ...cornerStyles[corner],
            }}
            onPointerDown={e => handleResizePointerDown(corner, e)}
            onPointerMove={e => handleResizePointerMove(corner, e)}
            onPointerUp={e => handleResizePointerUp(corner, e)}
          />
        ))
      )}
    </div>
  )
}
