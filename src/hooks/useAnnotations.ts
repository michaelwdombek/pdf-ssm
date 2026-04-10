import { useAppContext } from '../context/AppContext'
import type { Annotation } from '../types'

export function useAnnotations() {
  const { state, dispatch } = useAppContext()
  const currentPage = state.document.currentPage
  const currentPageAnnotations = state.annotations[currentPage] ?? []

  return {
    annotations: currentPageAnnotations,
    allAnnotations: state.annotations,
    selectedId: state.selectedAnnotationId,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,

    addAnnotation(a: Annotation) {
      dispatch({ type: 'ADD_ANNOTATION', payload: a })
    },
    moveAnnotation(id: string, x: number, y: number) {
      dispatch({ type: 'MOVE_ANNOTATION', payload: { id, page: currentPage, x, y } })
    },
    resizeAnnotation(id: string, x: number, y: number, width: number, height: number) {
      dispatch({ type: 'RESIZE_ANNOTATION', payload: { id, page: currentPage, x, y, width, height } })
    },
    deleteAnnotation(id: string) {
      dispatch({ type: 'DELETE_ANNOTATION', payload: { id, page: currentPage } })
    },
    selectAnnotation(id: string | null) {
      dispatch({ type: 'SELECT_ANNOTATION', payload: id })
    },
    undo() {
      dispatch({ type: 'UNDO' })
    },
    redo() {
      dispatch({ type: 'REDO' })
    },
  }
}
