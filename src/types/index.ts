import type { PDFDocumentProxy } from 'pdfjs-dist'

export type ToolMode = 'select' | 'sign' | 'stamp'

export interface LoadedAsset {
  id: string
  name: string
  type: 'signature' | 'stamp'
  dataUrl: string
  imageBytes: Uint8Array
  width: number
  height: number
}

export interface Annotation {
  id: string
  assetId: string
  type: 'signature' | 'stamp'
  page: number
  // All positions normalized to [0, 1] relative to PDF page dimensions
  x: number
  y: number
  width: number
  height: number
}

export type AnnotationSnapshot = Record<number, Annotation[]>

export interface AppState {
  document: {
    file: File | null
    pdfDocument: PDFDocumentProxy | null
    pdfBytes: Uint8Array | null
    pageCount: number
    currentPage: number
    zoom: number
    fileName: string
  }
  assets: {
    signatures: LoadedAsset[]
    stamps: LoadedAsset[]
    activeAssetId: string | null
  }
  toolMode: ToolMode
  annotations: Record<number, Annotation[]>
  selectedAnnotationId: string | null
  history: {
    past: AnnotationSnapshot[]
    future: AnnotationSnapshot[]
  }
}

export type AppAction =
  | {
      type: 'LOAD_DOCUMENT'
      payload: {
        file: File
        pdfDocument: PDFDocumentProxy
        pdfBytes: Uint8Array
        pageCount: number
        fileName: string
      }
    }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'ADD_ASSET'; payload: LoadedAsset }
  | { type: 'REMOVE_ASSET'; payload: string }
  | { type: 'SET_ACTIVE_ASSET'; payload: string | null }
  | { type: 'SET_TOOL'; payload: ToolMode }
  | { type: 'ADD_ANNOTATION'; payload: Annotation }
  | {
      type: 'MOVE_ANNOTATION'
      payload: { id: string; page: number; x: number; y: number }
    }
  | {
      type: 'RESIZE_ANNOTATION'
      payload: {
        id: string
        page: number
        x: number
        y: number
        width: number
        height: number
      }
    }
  | { type: 'DELETE_ANNOTATION'; payload: { id: string; page: number } }
  | { type: 'SELECT_ANNOTATION'; payload: string | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }

// Local component state types (not in global store)
export interface DragState {
  annotationId: string
  startPointerX: number
  startPointerY: number
  startAnnotX: number
  startAnnotY: number
}

export interface ResizeState {
  annotationId: string
  corner: 'nw' | 'ne' | 'se' | 'sw'
  startPointerX: number
  startPointerY: number
  startAnnotX: number
  startAnnotY: number
  startAnnotW: number
  startAnnotH: number
}

export interface RenderSize {
  width: number
  height: number
}
