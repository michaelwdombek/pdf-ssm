import * as pdfjsLib from 'pdfjs-dist'

// Set the worker source once, using Vite's BASE_URL so it works regardless of deployment path
pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`

export { pdfjsLib }
