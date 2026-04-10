import { PDFDocument, StandardFonts } from 'pdf-lib'

const MAX_IMAGE_DIM = 2400

/** Re-encode any image file to PNG bytes via a canvas element. */
async function imageFileToPngBytes(file: File): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        let w = img.naturalWidth
        let h = img.naturalHeight
        // Cap oversized images
        const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(w, h))
        w = Math.round(w * scale)
        h = Math.round(h * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return }
          blob.arrayBuffer().then(buf => {
            resolve({ bytes: new Uint8Array(buf), width: w, height: h })
          }).catch(reject)
        }, 'image/png')
      }
      img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
      img.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Convert an image file (PNG, JPG, WebP, BMP, TIFF) to a single-page PDF.
 * The page size matches the image dimensions.
 */
export async function imageToPdfBytes(file: File): Promise<Uint8Array> {
  const { bytes, width, height } = await imageFileToPngBytes(file)
  const pdfDoc = await PDFDocument.create()
  const img = await pdfDoc.embedPng(bytes)
  const page = pdfDoc.addPage([width, height])
  page.drawImage(img, { x: 0, y: 0, width, height })
  return pdfDoc.save()
}

/**
 * Convert an SVG file to a single-page PDF by rasterizing it to a canvas.
 */
export async function svgToPdfBytes(file: File): Promise<Uint8Array> {
  const text = await file.text()
  const blob = new Blob([text], { type: 'image/svg+xml' })
  // Wrap in a File-like object so imageFileToPngBytes can use createObjectURL
  const pngFile = new File([blob], file.name, { type: 'image/svg+xml' })
  const { bytes, width, height } = await imageFileToPngBytes(pngFile)
  const pdfDoc = await PDFDocument.create()
  const img = await pdfDoc.embedPng(bytes)
  const page = pdfDoc.addPage([width, height])
  page.drawImage(img, { x: 0, y: 0, width, height })
  return pdfDoc.save()
}

/**
 * Convert a plain text file to a paginated PDF.
 * Uses A4 size, Courier 10pt, ~80 chars/line, ~55 lines/page.
 */
export async function textToPdfBytes(file: File): Promise<Uint8Array> {
  const text = await file.text()
  const A4_WIDTH = 595
  const A4_HEIGHT = 842
  const MARGIN = 50
  const FONT_SIZE = 10
  const LINE_HEIGHT = 14
  const MAX_CHARS_PER_LINE = 85
  const MAX_LINES_PER_PAGE = Math.floor((A4_HEIGHT - 2 * MARGIN) / LINE_HEIGHT)

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Courier)

  // Word-wrap raw lines
  const rawLines = text.split('\n')
  const wrappedLines: string[] = []
  for (const line of rawLines) {
    if (line.length === 0) {
      wrappedLines.push('')
    } else {
      let remaining = line
      while (remaining.length > MAX_CHARS_PER_LINE) {
        wrappedLines.push(remaining.slice(0, MAX_CHARS_PER_LINE))
        remaining = remaining.slice(MAX_CHARS_PER_LINE)
      }
      wrappedLines.push(remaining)
    }
  }

  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
  let lineOnPage = 0

  for (const line of wrappedLines) {
    if (lineOnPage >= MAX_LINES_PER_PAGE) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
      lineOnPage = 0
    }
    const y = A4_HEIGHT - MARGIN - lineOnPage * LINE_HEIGHT
    page.drawText(line, {
      x: MARGIN,
      y,
      size: FONT_SIZE,
      font,
    })
    lineOnPage++
  }

  return pdfDoc.save()
}
