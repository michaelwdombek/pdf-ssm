import { PDFDocument } from 'pdf-lib'
import { normalizedToPdfCoords } from './geometry'
import type { Annotation, LoadedAsset } from '../types'

export async function exportAnnotatedPdf(
  pdfBytes: Uint8Array,
  annotations: Record<number, Annotation[]>,
  assets: LoadedAsset[],
  fileName: string
): Promise<void> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const assetMap = new Map(assets.map(a => [a.id, a]))

  // Pre-embed all unique assets that appear in any annotation to avoid
  // redundant embedding when the same stamp/signature is used multiple times
  const embeddedImages = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>()
  for (const pageAnnots of Object.values(annotations)) {
    for (const annot of pageAnnots) {
      if (!embeddedImages.has(annot.assetId)) {
        const asset = assetMap.get(annot.assetId)
        if (asset) {
          const img = await pdfDoc.embedPng(asset.imageBytes)
          embeddedImages.set(annot.assetId, img)
        }
      }
    }
  }

  // Draw annotations page by page
  for (const [pageNumStr, pageAnnots] of Object.entries(annotations)) {
    if (pageAnnots.length === 0) continue
    const pageIndex = parseInt(pageNumStr, 10) - 1  // 1-indexed → 0-indexed
    const page = pdfDoc.getPage(pageIndex)
    const { width: pageW, height: pageH } = page.getSize()

    for (const annot of pageAnnots) {
      const img = embeddedImages.get(annot.assetId)
      if (!img) continue
      const coords = normalizedToPdfCoords(annot.x, annot.y, annot.width, annot.height, pageW, pageH)
      page.drawImage(img, {
        x: coords.x,
        y: coords.y,
        width: coords.width,
        height: coords.height,
      })
    }
  }

  const outputBytes = await pdfDoc.save()
  const blob = new Blob([outputBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.replace(/(\.[^.]+)?$/, '_signed.pdf')
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a short delay to ensure the download initiates
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
