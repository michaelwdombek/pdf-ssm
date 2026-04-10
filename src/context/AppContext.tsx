import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { AppState, AppAction, AnnotationSnapshot, Annotation } from '../types'

const initialState: AppState = {
  document: {
    file: null,
    pdfDocument: null,
    pdfBytes: null,
    pageCount: 0,
    currentPage: 1,
    zoom: 1.0,
    fileName: '',
  },
  assets: {
    signatures: [],
    stamps: [],
    activeAssetId: null,
  },
  toolMode: 'select',
  annotations: {},
  selectedAnnotationId: null,
  history: {
    past: [],
    future: [],
  },
}

function cloneAnnotations(annotations: Record<number, Annotation[]>): AnnotationSnapshot {
  return Object.fromEntries(
    Object.entries(annotations).map(([k, v]) => [k, v.map(a => ({ ...a }))])
  )
}

function pushHistory(state: AppState): AppState['history'] {
  return {
    past: [...state.history.past, cloneAnnotations(state.annotations)],
    future: [],
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD_DOCUMENT':
      return {
        ...state,
        document: {
          file: action.payload.file,
          pdfDocument: action.payload.pdfDocument,
          pdfBytes: action.payload.pdfBytes,
          pageCount: action.payload.pageCount,
          currentPage: 1,
          zoom: 1.0,
          fileName: action.payload.fileName,
        },
        annotations: {},
        selectedAnnotationId: null,
        history: { past: [], future: [] },
      }

    case 'SET_PAGE':
      return {
        ...state,
        document: { ...state.document, currentPage: action.payload },
        selectedAnnotationId: null,
      }

    case 'SET_ZOOM':
      return {
        ...state,
        document: { ...state.document, zoom: action.payload },
      }

    case 'ADD_ASSET': {
      const asset = action.payload
      const isSignature = asset.type === 'signature'
      return {
        ...state,
        assets: {
          signatures: isSignature
            ? [...state.assets.signatures, asset]
            : state.assets.signatures,
          stamps: !isSignature
            ? [...state.assets.stamps, asset]
            : state.assets.stamps,
          activeAssetId: asset.id,
        },
      }
    }

    case 'REMOVE_ASSET': {
      const id = action.payload
      const newSignatures = state.assets.signatures.filter(a => a.id !== id)
      const newStamps = state.assets.stamps.filter(a => a.id !== id)
      const wasActive = state.assets.activeAssetId === id
      const allAssets = [...newSignatures, ...newStamps]
      return {
        ...state,
        assets: {
          signatures: newSignatures,
          stamps: newStamps,
          activeAssetId: wasActive ? (allAssets[0]?.id ?? null) : state.assets.activeAssetId,
        },
      }
    }

    case 'SET_ACTIVE_ASSET':
      return {
        ...state,
        assets: { ...state.assets, activeAssetId: action.payload },
      }

    case 'SET_TOOL':
      return { ...state, toolMode: action.payload }

    case 'ADD_ANNOTATION': {
      const ann = action.payload
      const pageAnnots = state.annotations[ann.page] ?? []
      return {
        ...state,
        annotations: {
          ...state.annotations,
          [ann.page]: [...pageAnnots, ann],
        },
        selectedAnnotationId: ann.id,
        history: pushHistory(state),
      }
    }

    case 'MOVE_ANNOTATION': {
      const { id, page, x, y } = action.payload
      const pageAnnots = state.annotations[page] ?? []
      return {
        ...state,
        annotations: {
          ...state.annotations,
          [page]: pageAnnots.map(a => (a.id === id ? { ...a, x, y } : a)),
        },
        history: pushHistory(state),
      }
    }

    case 'RESIZE_ANNOTATION': {
      const { id, page, x, y, width, height } = action.payload
      const pageAnnots = state.annotations[page] ?? []
      return {
        ...state,
        annotations: {
          ...state.annotations,
          [page]: pageAnnots.map(a =>
            a.id === id ? { ...a, x, y, width, height } : a
          ),
        },
        history: pushHistory(state),
      }
    }

    case 'DELETE_ANNOTATION': {
      const { id, page } = action.payload
      const pageAnnots = state.annotations[page] ?? []
      return {
        ...state,
        annotations: {
          ...state.annotations,
          [page]: pageAnnots.filter(a => a.id !== id),
        },
        selectedAnnotationId:
          state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
        history: pushHistory(state),
      }
    }

    case 'SELECT_ANNOTATION':
      return { ...state, selectedAnnotationId: action.payload }

    case 'SET_SERVER_ASSETS': {
      const { signatures: serverSigs, stamps: serverStamps } = action.payload
      const localSigs = state.assets.signatures.filter(a => a.source === 'local')
      const localStamps = state.assets.stamps.filter(a => a.source === 'local')
      return {
        ...state,
        assets: {
          ...state.assets,
          signatures: [...serverSigs, ...localSigs],
          stamps: [...serverStamps, ...localStamps],
        },
      }
    }

    case 'CLEAR_SERVER_ASSETS': {
      const localSigs = state.assets.signatures.filter(a => a.source === 'local')
      const localStamps = state.assets.stamps.filter(a => a.source === 'local')
      const allLocal = [...localSigs, ...localStamps]
      const activeStillExists = allLocal.some(a => a.id === state.assets.activeAssetId)
      return {
        ...state,
        assets: {
          signatures: localSigs,
          stamps: localStamps,
          activeAssetId: activeStillExists ? state.assets.activeAssetId : null,
        },
      }
    }

    case 'LOAD_SERVER_DOCUMENT':
      return {
        ...state,
        document: {
          file: action.payload.file,
          pdfDocument: action.payload.pdfDocument,
          pdfBytes: action.payload.pdfBytes,
          pageCount: action.payload.pageCount,
          currentPage: 1,
          zoom: 1.0,
          fileName: action.payload.fileName,
        },
        annotations: action.payload.annotations,
        selectedAnnotationId: null,
        history: { past: [], future: [] },
      }

    case 'UNDO': {
      if (state.history.past.length === 0) return state
      const past = [...state.history.past]
      const previous = past.pop()!
      return {
        ...state,
        annotations: previous,
        selectedAnnotationId: null,
        history: {
          past,
          future: [cloneAnnotations(state.annotations), ...state.history.future],
        },
      }
    }

    case 'REDO': {
      if (state.history.future.length === 0) return state
      const future = [...state.history.future]
      const next = future.shift()!
      return {
        ...state,
        annotations: next,
        selectedAnnotationId: null,
        history: {
          past: [...state.history.past, cloneAnnotations(state.annotations)],
          future,
        },
      }
    }

    default:
      return state
  }
}

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
